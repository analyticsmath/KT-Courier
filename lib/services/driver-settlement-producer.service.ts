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
import { accrueCommissionInTransaction, type QaHistoricalRecoveryPlanOverride } from "./commission-accrual.service";
import {
  qaSettlementRecoveryKey,
  readQaSettlementRecoveryInTx,
  type QaSettlementRecoveryRecord,
} from "@/lib/qa-acceptance/settlement-recovery";

const STANDARD_SETTLEMENT_VERSION = "courier-fulfilment-v1";
const QA_RECOVERY_SETTLEMENT_VERSION = "courier-fulfilment-v1:qa-recovery";
const identity = (kind: string, orderId: string, settlementVersion = STANDARD_SETTLEMENT_VERSION) =>
  settlementVersion === STANDARD_SETTLEMENT_VERSION
    ? `${kind}:${createHash("sha256").update(orderId).digest("hex")}:v1`
    : `${kind}:${createHash("sha256").update(`${orderId}:${settlementVersion}`).digest("hex")}:v1`;
function invalid(message: string): never { throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", message); }

type SettlementPlanCandidate = Awaited<ReturnType<typeof prisma.commissionPlan.findMany<{ include: { rules: true } }>>>[number];

function isEligibleHistoricalCourierPlan(
  plan: SettlementPlanCandidate,
  completedAt: Date,
): boolean {
  return Boolean(
    plan.status === "ACTIVE" &&
      plan.currency === "ZAR" &&
      plan.effectiveFrom <= completedAt &&
      (!plan.effectiveUntil || plan.effectiveUntil > completedAt) &&
      plan.approvedAt &&
      plan.approvedByUserId &&
      plan.approvedByUserId !== plan.createdByUserId &&
      plan.approvedAt <= completedAt,
  );
}

/** Only a canonical order identity is accepted. Money, drivers and policy cannot be
 * supplied by a worker or request. Commission and net payable commit atomically. */
export async function produceDriverSettlement(orderId: string) {
  assertCommissionProductionReady();
  const source = await prisma.orderAssignment.findMany({ where: { orderId, status: "COMPLETED" }, select: { driverProfileId: true }, take: 2 });
  if (source.length !== 1) invalid("A single completed assignment must own the courier delivery basis.");
  const provisioned = await ensureDriverEarningPayableAccount(source[0].driverProfileId);
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id"=${orderId} FOR UPDATE`);
    const existingAny = await tx.driverEarning.findFirst({ where: { orderId } });
    if (existingAny) {
      const stdOp = identity("driver-settlement", orderId, STANDARD_SETTLEMENT_VERSION);
      const recOp = identity("driver-settlement", orderId, QA_RECOVERY_SETTLEMENT_VERSION);
      if (existingAny.creationIdempotencyKey === stdOp || existingAny.creationIdempotencyKey === recOp) {
        return { publicReference: existingAny.publicReference, replayed: true };
      }
      invalid("The courier quote already has a driver allocation requiring review.");
    }
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { pricingQuote: true, assignments: { where: { status: "COMPLETED" }, include: { proofOfDelivery: true, operationalEvents: true, events: true } }, payments: { where: { status: "SUCCEEDED" } }, marketplaceStoreOrderBridge: { include: { storeOrder: { include: { marketplaceOrder: { include: { payment: true } } } } } } } });
    if (!order?.pricingQuote || order.currency !== "ZAR" || order.assignments.length !== 1) invalid("Immutable ZAR pricing and one canonical assignment are required.");
    const assignment = order.assignments[0];
    if (!assignment.completedAt || !assignment.proofOfDelivery || assignment.driverProfileId !== provisioned.driver.id) invalid("Completed delivery evidence must identify the canonical driver.");
    const completedAt = assignment.completedAt!.toISOString();
    const assignmentReference = assignmentPublicReference(assignment.id);
    assertAuthoritativeAssignment({ id: assignment.id, publicReference: assignmentReference, version: String(assignment.version), driverId: assignment.driverProfileId, orderId, status: assignment.status, completedAt, podAssignmentId: assignment.proofOfDelivery!.assignmentId, podDriverId: assignment.proofOfDelivery!.driverProfileId, podOrderId: assignment.proofOfDelivery!.orderId, podDeliveredAt: assignment.proofOfDelivery!.deliveredAt.toISOString(), hasDeliveryCompletedEvent: assignment.operationalEvents.some(e => e.eventType === "DELIVERY_COMPLETED"), hasAssignmentCompletedEvent: assignment.events.some(e => e.eventType === "ASSIGNMENT_COMPLETED") }, { assignmentId: assignment.id, assignmentPublicReference: assignmentReference, assignmentVersion: String(assignment.version), driverId: assignment.driverProfileId, orderId, serviceCompletedAt: completedAt });
    const basis = commissionBasisFromOrder({ order, quote: order.pricingQuote!, authoritativeAt: assignment.completedAt! });

    const globalPlans = await tx.commissionPlan.findMany({ where: { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", status: "ACTIVE", currency: "ZAR", effectiveFrom: { lte: assignment.completedAt! }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: assignment.completedAt! } }] }, include: { rules: true }, take: 2 });
    const singleGlobalPlan = globalPlans.length === 1 && isEligibleHistoricalCourierPlan(globalPlans[0], assignment.completedAt!) ? globalPlans[0] : null;

    let plan: SettlementPlanCandidate | null = singleGlobalPlan;
    let scopeKey: "GLOBAL:COURIER_ORDER" | "QA:COURIER_ORDER" = "GLOBAL:COURIER_ORDER";
    let settlementVersion = STANDARD_SETTLEMENT_VERSION;
    let qaRecoveryOverride: QaHistoricalRecoveryPlanOverride | undefined;
    let qaRecoveryRowId: string | null = null;
    let qaRecoveryUpdatedAt: Date | null = null;
    let qaRecoveryRecord: QaSettlementRecoveryRecord | null = null;

    if (!plan && order.isQaAcceptance === true) {
      // First check if a QA-scoped courier plan was active & independently approved prior to delivery completion.
      const qaPlans = await tx.commissionPlan.findMany({ where: { subjectType: "COURIER_ORDER", scopeKey: "QA:COURIER_ORDER", status: "ACTIVE", currency: "ZAR", effectiveFrom: { lte: assignment.completedAt! }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: assignment.completedAt! } }] }, include: { rules: true }, take: 2 });
      const singleQaPlan = qaPlans.length === 1 && isEligibleHistoricalCourierPlan(qaPlans[0], assignment.completedAt!) ? qaPlans[0] : null;
      if (singleQaPlan) {
        plan = singleQaPlan;
        scopeKey = "QA:COURIER_ORDER";
      } else {
        // Explicit bounded dual-approved QA historical recovery path: never alters plan approvedAt or assignment completedAt.
        const recoveryKey = qaSettlementRecoveryKey(order.id);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${recoveryKey}))`;
        const recovery = await readQaSettlementRecoveryInTx(tx, order.id);
        if (
          recovery &&
          recovery.record.status === "APPROVED" &&
          recovery.record.orderId === order.id &&
          recovery.record.approvedByUserId &&
          recovery.record.approvedByUserId !== recovery.record.preparedByUserId &&
          (!order.qaAcceptanceRunId || recovery.record.qaAcceptanceRunId === order.qaAcceptanceRunId)
        ) {
          const recPlan = await tx.commissionPlan.findUnique({
            where: { publicReference: recovery.record.planPublicReference },
            include: { rules: true },
          });
          if (
            recPlan &&
            recPlan.status === "ACTIVE" &&
            recPlan.subjectType === "COURIER_ORDER" &&
            (recPlan.scopeKey === "GLOBAL:COURIER_ORDER" || recPlan.scopeKey === "QA:COURIER_ORDER") &&
            recPlan.currency === "ZAR" &&
            recPlan.approvedAt &&
            recPlan.approvedByUserId &&
            recPlan.approvedByUserId !== recPlan.createdByUserId &&
            (!recPlan.effectiveUntil || recPlan.effectiveUntil > new Date())
          ) {
            plan = recPlan;
            scopeKey = recPlan.scopeKey as "GLOBAL:COURIER_ORDER" | "QA:COURIER_ORDER";
            settlementVersion = QA_RECOVERY_SETTLEMENT_VERSION;
            qaRecoveryOverride = {
              orderId: order.id,
              planPublicReference: recPlan.publicReference,
              preparedByUserId: recovery.record.preparedByUserId,
              approvedByUserId: recovery.record.approvedByUserId,
            };
            qaRecoveryRowId = recovery.rowId;
            qaRecoveryUpdatedAt = recovery.updatedAt;
            qaRecoveryRecord = recovery.record;
          }
        }
      }
    }

    if (!plan) {
      invalid(
        order.isQaAcceptance
          ? "No historical QA/global courier commission plan or independently approved QA settlement recovery authorization exists for this delivery."
          : "A single reviewed commission plan effective at delivery completion is required.",
      );
    }

    // Required beneficiary rules fail closed in the canonical calculator until a
    // courier-specific immutable beneficiary authority is available.
    const calculation = calculateCommission({ basis, basisType: plan.basisType, calculationVersion: plan.calculationVersion, rules: plan.rules });
    const gross = new Prisma.Decimal(basis.total);
    const net = gross.sub(calculation.totalAmount);
    if (net.lte(0)) invalid("Approved deductions must leave a positive driver earning.");
    const bridge = order.marketplaceStoreOrderBridge;
    const payment = bridge ? bridge.storeOrder.marketplaceOrder.payment : order.payments.length === 1 ? order.payments[0] : null;
    if (!payment) invalid("One canonical funding payment is required.");
    const operationId = identity("driver-settlement", orderId, settlementVersion);
    const commission = await accrueCommissionInTransaction(
      tx,
      {
        subjectType: "COURIER_ORDER",
        subjectId: order.id,
        subjectPublicReference: order.orderNumber,
        settlementVersion,
        scopeKey,
        authoritativeAt: completedAt,
        basis,
        planPublicReference: plan.publicReference,
        planVersionNumber: plan.versionNumber,
      },
      { operationId: identity("driver-commission", orderId, settlementVersion) },
      qaRecoveryOverride ? { qaHistoricalRecoveryAuthorized: qaRecoveryOverride } : undefined,
    );
    const earning = await accrueDriverEarningInTransaction(tx, { operationId, snapshot: { subjectType: "COURIER_DELIVERY", subjectId: assignment.id, subjectPublicReference: assignmentReference, assignmentId: assignment.id, assignmentPublicReference: assignmentReference, assignmentVersion: String(assignment.version), driverId: provisioned.driver.id, driverPublicReference: provisioned.driver.publicReference, walletId: provisioned.wallet.id, orderId, orderPublicReference: order.orderNumber, paymentId: payment!.id, paymentPublicReference: payment!.publicReference, settlementReference: identity("courier-source", orderId, settlementVersion), settlementVersion, calculationVersion: settlementVersion, completionEvidenceReference: `POD:${assignment.proofOfDelivery!.id}`, serviceCompletedAt: completedAt, authoritativeAt: completedAt, releaseEligibleAt: null, driverSettlementBasisAmount: gross.toFixed(2), attributedCommissionAmount: commission.totalAmount, netDriverEarningAmount: net.toFixed(2), currency: "ZAR", commissionCharges: commission.allocationEvidence.map(a => ({ commissionAllocationId: a.id, commissionAllocationPublicReference: a.publicReference, amount: a.amount, currency: "ZAR" })) } }, provisioned);
    if (qaRecoveryRowId && qaRecoveryUpdatedAt && qaRecoveryRecord) {
      const nextRecovery = {
        ...qaRecoveryRecord,
        status: "CONSUMED" as const,
        consumedAt: new Date().toISOString(),
        driverEarningPublicReference: earning.publicReference as string,
        commissionAccrualPublicReference: commission.publicReference as string,
      };
      await tx.systemSetting.update({
        where: { id: qaRecoveryRowId, updatedAt: qaRecoveryUpdatedAt },
        data: { value: nextRecovery as unknown as Prisma.InputJsonValue },
      });
    }
    return { publicReference: earning.publicReference as string, commissionReference: commission.publicReference as string, settlementVersion, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export type DriverSettlementDiagnostic = Readonly<{
  orderId: string;
  orderNumber: string;
  isQaAcceptance: boolean;
  settled: boolean;
  blockerCode: string | null;
  blockerMessage: string | null;
  completedAt: string | null;
  hasHistoricalGlobalPlan: boolean;
  hasHistoricalQaPlan: boolean;
  hasApprovedQaRecovery: boolean;
}>;

export async function diagnoseDriverSettlementReadiness(
  orderId: string,
): Promise<DriverSettlementDiagnostic | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      pricingQuote: true,
      assignments: { where: { status: "COMPLETED" }, include: { proofOfDelivery: true } },
      payments: { where: { status: "SUCCEEDED" } },
      marketplaceStoreOrderBridge: { include: { storeOrder: { include: { marketplaceOrder: { include: { payment: true } } } } } },
      driverEarnings: { select: { publicReference: true }, take: 1 },
    },
  });
  if (!order) return null;
  const completedAssignment = order.assignments.length === 1 ? order.assignments[0] : null;
  const completedAt = completedAssignment?.completedAt ?? null;
  if (order.driverEarnings.length > 0) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      isQaAcceptance: order.isQaAcceptance,
      settled: true,
      blockerCode: null,
      blockerMessage: null,
      completedAt: completedAt?.toISOString() ?? null,
      hasHistoricalGlobalPlan: true,
      hasHistoricalQaPlan: false,
      hasApprovedQaRecovery: false,
    };
  }
  if (!completedAssignment || !completedAt || !completedAssignment.proofOfDelivery) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      isQaAcceptance: order.isQaAcceptance,
      settled: false,
      blockerCode: "ASSIGNMENT_INCOMPLETE",
      blockerMessage: "Order lacks a single completed assignment with ProofOfDelivery.",
      completedAt: null,
      hasHistoricalGlobalPlan: false,
      hasHistoricalQaPlan: false,
      hasApprovedQaRecovery: false,
    };
  }
  const payment = order.marketplaceStoreOrderBridge
    ? order.marketplaceStoreOrderBridge.storeOrder.marketplaceOrder.payment
    : order.payments.length === 1
      ? order.payments[0]
      : null;
  if (!payment || !order.pricingQuote || order.currency !== "ZAR") {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      isQaAcceptance: order.isQaAcceptance,
      settled: false,
      blockerCode: "PAYMENT_OR_QUOTE_MISSING",
      blockerMessage: "Canonical ZAR pricing quote or single succeeded payment missing.",
      completedAt: completedAt.toISOString(),
      hasHistoricalGlobalPlan: false,
      hasHistoricalQaPlan: false,
      hasApprovedQaRecovery: false,
    };
  }

  const [globalPlans, qaPlans, recovery] = await Promise.all([
    prisma.commissionPlan.findMany({
      where: {
        subjectType: "COURIER_ORDER",
        scopeKey: "GLOBAL:COURIER_ORDER",
        status: "ACTIVE",
        currency: "ZAR",
        effectiveFrom: { lte: completedAt },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: completedAt } }],
      },
      include: { rules: true },
      take: 2,
    }),
    order.isQaAcceptance
      ? prisma.commissionPlan.findMany({
          where: {
            subjectType: "COURIER_ORDER",
            scopeKey: "QA:COURIER_ORDER",
            status: "ACTIVE",
            currency: "ZAR",
            effectiveFrom: { lte: completedAt },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: completedAt } }],
          },
          include: { rules: true },
          take: 2,
        })
      : Promise.resolve([]),
    order.isQaAcceptance ? readQaSettlementRecoveryInTx(prisma, order.id) : Promise.resolve(null),
  ]);

  const hasHistoricalGlobalPlan =
    globalPlans.length === 1 && isEligibleHistoricalCourierPlan(globalPlans[0], completedAt);
  const hasHistoricalQaPlan =
    order.isQaAcceptance && qaPlans.length === 1 && isEligibleHistoricalCourierPlan(qaPlans[0], completedAt);
  const hasApprovedQaRecovery = Boolean(
    order.isQaAcceptance &&
      recovery?.record.status === "APPROVED" &&
      recovery.record.approvedByUserId &&
      recovery.record.approvedByUserId !== recovery.record.preparedByUserId,
  );

  let blockerCode: string | null = null;
  let blockerMessage: string | null = null;
  if (!hasHistoricalGlobalPlan && !hasHistoricalQaPlan && !hasApprovedQaRecovery) {
    blockerCode = order.isQaAcceptance
      ? recovery?.record.status === "PENDING_REVIEW"
        ? "QA_RECOVERY_AWAITING_INDEPENDENT_APPROVAL"
        : "COURIER_COMMISSION_PLAN_NOT_EFFECTIVE_AT_COMPLETION"
      : "COURIER_COMMISSION_PLAN_MISSING";
    blockerMessage = order.isQaAcceptance
      ? recovery?.record.status === "PENDING_REVIEW"
        ? `QA settlement recovery prepared for ${order.orderNumber}; awaiting second administrator approval.`
        : `No GLOBAL:COURIER_ORDER or QA:COURIER_ORDER commission plan was approved & effective at ${completedAt.toISOString()}. Prepare & independently approve a QA settlement recovery or activate a scoped QA courier plan for future deliveries.`
      : `No reviewed GLOBAL:COURIER_ORDER commission plan effective at ${completedAt.toISOString()}.`;
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    isQaAcceptance: order.isQaAcceptance,
    settled: false,
    blockerCode,
    blockerMessage,
    completedAt: completedAt.toISOString(),
    hasHistoricalGlobalPlan,
    hasHistoricalQaPlan,
    hasApprovedQaRecovery,
  };
}

/** Stable cursor makes blocked sources visible without starving later deliveries. */
export async function produceDriverSettlementsBatch(input: { limit?: number; afterId?: string; mode?: "DRY_RUN" | "APPLY" } = {}) {
  const mode = input.mode ?? "APPLY";
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 25)));
  const rows = await prisma.order.findMany({ where: { id: input.afterId ? { gt: input.afterId } : undefined, status: { in: ["DELIVERED", "COMPLETED"] }, assignments: { some: { status: "COMPLETED" } }, driverEarnings: { none: {} } }, orderBy: { id: "asc" }, select: { id: true }, take: limit });
  const results: { orderId: string; outcome: "ACCRUED" | "READY" | "BLOCKED"; code?: string; message?: string | null }[] = [];
  for (const row of rows) {
    if (mode === "DRY_RUN") {
      const diag = await diagnoseDriverSettlementReadiness(row.id);
      if (!diag || diag.blockerCode) {
        results.push({ orderId: row.id, outcome: "BLOCKED", code: diag?.blockerCode ?? "SETTLEMENT_REVIEW_REQUIRED", message: diag?.blockerMessage ?? null });
      } else {
        results.push({ orderId: row.id, outcome: "READY" });
      }
      continue;
    }
    try { await produceDriverSettlement(row.id); results.push({ orderId: row.id, outcome: "ACCRUED" }); }
    catch (error) { results.push({ orderId: row.id, outcome: "BLOCKED", code: typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "SETTLEMENT_REVIEW_REQUIRED", message: error instanceof Error ? error.message : null }); }
  }
  return { mode, results, nextCursor: rows.length === limit ? rows.at(-1)!.id : null };
}
