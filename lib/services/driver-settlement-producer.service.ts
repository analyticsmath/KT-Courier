import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { commissionBasisFromOrder } from "@/lib/commissions/commission-basis";
import { calculateCommission } from "@/lib/commissions/commission-calculator";
import { assertCommissionProductionReady } from "@/lib/commissions/commission-production-readiness";
import { DriverEarningError } from "@/lib/driver-earnings/errors";
import { assertAuthoritativeAssignment } from "@/lib/driver-earnings/driver-earning-assignment-policy";
import { assignmentPublicReference } from "@/lib/driver-earnings/driver-earning-subject";
import { ensureDriverEarningPayableAccount } from "./driver-earning-account.service";
import { accrueDriverEarningInTransaction } from "./driver-earning-accrual.service";
import { accrueCommissionInTransaction } from "./commission-accrual.service";

const version = "courier-fulfilment-v1";
const identity = (kind: string, orderId: string) => `${kind}:${createHash("sha256").update(orderId).digest("hex")}:v1`;
function invalid(message: string): never { throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", message); }

/** Only a canonical order identity is accepted. Money, drivers and policy cannot be
 * supplied by a worker or request. Commission and net payable commit atomically. */
export async function produceDriverSettlement(orderId: string) {
  assertCommissionProductionReady();
  const source = await prisma.orderAssignment.findMany({ where: { orderId, status: "COMPLETED" }, select: { driverProfileId: true }, take: 2 });
  if (source.length !== 1) invalid("A single completed assignment must own the courier delivery basis.");
  const provisioned = await ensureDriverEarningPayableAccount(source[0].driverProfileId);
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id"=${orderId} FOR UPDATE`);
    const operationId = identity("driver-settlement", orderId);
    const existing = await tx.driverEarning.findUnique({ where: { creationIdempotencyKey: operationId } });
    if (existing) return { publicReference: existing.publicReference, replayed: true };
    if (await tx.driverEarning.findFirst({ where: { orderId } })) invalid("The courier quote already has a driver allocation requiring review.");
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { pricingQuote: true, assignments: { where: { status: "COMPLETED" }, include: { proofOfDelivery: true, operationalEvents: true, events: true } }, payments: { where: { status: "SUCCEEDED" } }, marketplaceStoreOrderBridge: { include: { storeOrder: { include: { marketplaceOrder: { include: { payment: true } } } } } } } });
    if (!order?.pricingQuote || order.currency !== "ZAR" || order.assignments.length !== 1) invalid("Immutable ZAR pricing and one canonical assignment are required.");
    const assignment = order.assignments[0];
    if (!assignment.completedAt || !assignment.proofOfDelivery || assignment.driverProfileId !== provisioned.driver.id) invalid("Completed delivery evidence must identify the canonical driver.");
    const completedAt = assignment.completedAt!.toISOString();
    const assignmentReference = assignmentPublicReference(assignment.id);
    assertAuthoritativeAssignment({ id: assignment.id, publicReference: assignmentReference, version: String(assignment.version), driverId: assignment.driverProfileId, orderId, status: assignment.status, completedAt, podAssignmentId: assignment.proofOfDelivery!.assignmentId, podDriverId: assignment.proofOfDelivery!.driverProfileId, podOrderId: assignment.proofOfDelivery!.orderId, podDeliveredAt: assignment.proofOfDelivery!.deliveredAt.toISOString(), hasDeliveryCompletedEvent: assignment.operationalEvents.some(e => e.eventType === "DELIVERY_COMPLETED"), hasAssignmentCompletedEvent: assignment.events.some(e => e.eventType === "ASSIGNMENT_COMPLETED") }, { assignmentId: assignment.id, assignmentPublicReference: assignmentReference, assignmentVersion: String(assignment.version), driverId: assignment.driverProfileId, orderId, serviceCompletedAt: completedAt });
    const basis = commissionBasisFromOrder({ order, quote: order.pricingQuote!, authoritativeAt: assignment.completedAt! });
    const plans = await tx.commissionPlan.findMany({ where: { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", status: "ACTIVE", currency: "ZAR", effectiveFrom: { lte: assignment.completedAt! }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: assignment.completedAt! } }] }, include: { rules: true }, take: 2 });
    if (plans.length !== 1 || !plans[0].approvedAt || !plans[0].approvedByUserId || plans[0].approvedAt > assignment.completedAt!) invalid("A single reviewed commission plan effective at delivery completion is required.");
    const plan = plans[0];
    // Required beneficiary rules fail closed in the canonical calculator until a
    // courier-specific immutable beneficiary authority is available.
    const calculation = calculateCommission({ basis, basisType: plan.basisType, calculationVersion: plan.calculationVersion, rules: plan.rules });
    const gross = new Prisma.Decimal(basis.total);
    const net = gross.sub(calculation.totalAmount);
    if (net.lte(0)) invalid("Approved deductions must leave a positive driver earning.");
    const bridge = order.marketplaceStoreOrderBridge;
    const payment = bridge ? bridge.storeOrder.marketplaceOrder.payment : order.payments.length === 1 ? order.payments[0] : null;
    if (!payment) invalid("One canonical funding payment is required.");
    const commission = await accrueCommissionInTransaction(tx, { subjectType: "COURIER_ORDER", subjectId: order.id, subjectPublicReference: order.orderNumber, settlementVersion: version, scopeKey: "GLOBAL:COURIER_ORDER", authoritativeAt: completedAt, basis, planPublicReference: plan.publicReference, planVersionNumber: plan.versionNumber }, { operationId: identity("driver-commission", orderId) });
    const earning = await accrueDriverEarningInTransaction(tx, { operationId, snapshot: { subjectType: "COURIER_DELIVERY", subjectId: assignment.id, subjectPublicReference: assignmentReference, assignmentId: assignment.id, assignmentPublicReference: assignmentReference, assignmentVersion: String(assignment.version), driverId: provisioned.driver.id, driverPublicReference: provisioned.driver.publicReference, walletId: provisioned.wallet.id, orderId, orderPublicReference: order.orderNumber, paymentId: payment!.id, paymentPublicReference: payment!.publicReference, settlementReference: identity("courier-source", orderId), settlementVersion: version, calculationVersion: version, completionEvidenceReference: `POD:${assignment.proofOfDelivery!.id}`, serviceCompletedAt: completedAt, authoritativeAt: completedAt, releaseEligibleAt: null, driverSettlementBasisAmount: gross.toFixed(2), attributedCommissionAmount: commission.totalAmount, netDriverEarningAmount: net.toFixed(2), currency: "ZAR", commissionCharges: commission.allocationEvidence.map(a => ({ commissionAllocationId: a.id, commissionAllocationPublicReference: a.publicReference, amount: a.amount, currency: "ZAR" })) } }, provisioned);
    return { publicReference: earning.publicReference as string, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/** Stable cursor makes blocked sources visible without starving later deliveries. */
export async function produceDriverSettlementsBatch(input: { limit?: number; afterId?: string } = {}) {
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 25)));
  const rows = await prisma.order.findMany({ where: { id: input.afterId ? { gt: input.afterId } : undefined, status: { in: ["DELIVERED", "COMPLETED"] }, assignments: { some: { status: "COMPLETED" } }, driverEarnings: { none: {} } }, orderBy: { id: "asc" }, select: { id: true }, take: limit });
  const results: { orderId: string; outcome: "ACCRUED" | "BLOCKED"; code?: string }[] = [];
  for (const row of rows) {
    try { await produceDriverSettlement(row.id); results.push({ orderId: row.id, outcome: "ACCRUED" }); }
    catch (error) { results.push({ orderId: row.id, outcome: "BLOCKED", code: typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "SETTLEMENT_REVIEW_REQUIRED" }); }
  }
  return { results, nextCursor: rows.length === limit ? rows.at(-1)!.id : null };
}
