/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 17 Prisma Client generation and model type proof are intentionally deferred. */
import { assertMarketplaceDigitalReceipt, assertMarketplaceCashJournals, marketplaceDigitalReceiptInclude } from "@/lib/marketplace-checkout/payment-funding";
import { parseMarketplacePaymentPlan } from "@/lib/marketplace-checkout/payment-plan";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { DriverEarningError } from "@/lib/driver-earnings/errors";
import { assertAuthoritativeAssignment } from "@/lib/driver-earnings/driver-earning-assignment-policy";
import { assertDriverCommissionAttribution } from "@/lib/driver-earnings/driver-commission-attribution";
import { hashDriverEarningCalculation } from "@/lib/driver-earnings/driver-earning-idempotency";
import { driverEarningAccrualPosting } from "@/lib/driver-earnings/driver-earning-ledger-policy";
import { formatDriverEarningMoney } from "@/lib/driver-earnings/driver-earning-money";
import { assertDriverEarningsProductionReady } from "@/lib/driver-earnings/driver-earning-production-readiness";
import { validateDriverSettlementSnapshot, type DriverSettlementSnapshot } from "@/lib/driver-earnings/driver-settlement-snapshot";
import { assignmentPublicReference } from "@/lib/driver-earnings/driver-earning-subject";
import { ensureDriverEarningPayableAccount, resolveDriverEarningAccountsWithinTransaction } from "./driver-earning-account.service";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";

const db = prisma as any;
const OPERATION = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const ref = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const journalInclude = { accrualLedgerJournal: { select: { reference: true } }, releaseLedgerJournal: { select: { reference: true } }, reversalLedgerJournal: { select: { reference: true } } } as const;

function dto(row: any) { return Object.freeze({ id: row.id, publicReference: row.publicReference, status: row.status, settlementBasisAmount: formatDriverEarningMoney(row.settlementBasisAmount), attributedCommissionAmount: formatDriverEarningMoney(row.attributedCommissionAmount), amount: formatDriverEarningMoney(row.amount), currency: row.currency, accrualLedgerJournalReference: row.accrualLedgerJournal.reference, releaseLedgerJournalReference: row.releaseLedgerJournal?.reference ?? null, reversalLedgerJournalReference: row.reversalLedgerJournal?.reference ?? null }); }
function assertPayment(payment: any, snapshot: DriverSettlementSnapshot, marketplaceFunding = false) { const webhook = payment?.successWebhookEvent; if (!payment || (!marketplaceFunding && payment.orderId !== snapshot.orderId) || payment.publicReference !== snapshot.paymentPublicReference || payment.status !== "SUCCEEDED" || payment.currency !== "ZAR" || payment.successfulAttempt?.status !== "SUCCEEDED" || payment.successLedgerJournal?.type !== "EXTERNAL_PAYMENT_RECEIPT" || !webhook || webhook.processingStatus !== "APPLIED" || !webhook.signatureVerified || !webhook.merchantVerified || !webhook.amountVerified || !webhook.providerDataVerified) throw new DriverEarningError("DRIVER_EARNING_PAYMENT_INVALID", "A verified successful matching ZAR payment is required."); if (!payment.totalRefundedAmount.isZero() || !payment.totalRefundReservedAmount.isZero() || payment.reconciliationStatus !== "CLEAR") throw new DriverEarningError("DRIVER_EARNING_REFUND_EVIDENCE_REQUIRED", "Payment has incompatible refund or reconciliation exposure."); }
const paymentInclude = marketplaceDigitalReceiptInclude;
function assignmentEvidence(row: any) { return { id: row.id, publicReference: assignmentPublicReference(row.id), version: String(row.version), driverId: row.driverProfileId, orderId: row.orderId, status: row.status, completedAt: row.completedAt?.toISOString() ?? null, podAssignmentId: row.proofOfDelivery?.assignmentId ?? null, podDriverId: row.proofOfDelivery?.driverProfileId ?? null, podOrderId: row.proofOfDelivery?.orderId ?? null, podDeliveredAt: row.proofOfDelivery?.deliveredAt?.toISOString() ?? null, hasDeliveryCompletedEvent: row.operationalEvents.some((e: any) => e.eventType === "DELIVERY_COMPLETED"), hasAssignmentCompletedEvent: row.events.some((e: any) => e.eventType === "ASSIGNMENT_COMPLETED") }; }

export type DriverEarningAccrualCommand = Readonly<{ operationId: string; snapshot: DriverSettlementSnapshot; actorUserId?: string }>;

/** Compose with commission posting in the same serializable transaction. The caller
 * provisions canonical accounts first; all financial evidence is rechecked here. */
export async function accrueDriverEarningInTransaction(transaction: Prisma.TransactionClient, command: DriverEarningAccrualCommand, provisioned: Awaited<ReturnType<typeof ensureDriverEarningPayableAccount>>) {
  const tx = transaction as any;
  assertDriverEarningsProductionReady();
  if (!OPERATION.test(command.operationId)) throw new DriverEarningError("DRIVER_EARNING_INVALID_COMMAND", "A valid internal operation ID is required.");
  const snapshot = validateDriverSettlementSnapshot(command.snapshot);
  const calculationHash = hashDriverEarningCalculation(snapshot);
  if (provisioned.driver.publicReference !== snapshot.driverPublicReference || provisioned.wallet.id !== snapshot.walletId) throw new DriverEarningError("DRIVER_EARNING_ACCOUNT_INVALID", "Snapshot driver wallet does not match the canonical owner.");
  const earningReference = ref("DE");
    const replay = await tx.driverEarning.findUnique({ where: { creationIdempotencyKey: command.operationId }, include: journalInclude });
    if (replay) { if (replay.creationRequestHash !== calculationHash) throw new DriverEarningError("DRIVER_EARNING_IDEMPOTENCY_CONFLICT", "Operation ID was used with different settlement evidence."); return replay; }
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "OrderAssignment" WHERE "id"=${snapshot.assignmentId} FOR UPDATE`);
    const assignment = await tx.orderAssignment.findUnique({ where: { id: snapshot.assignmentId }, include: { proofOfDelivery: true, operationalEvents: { select: { eventType: true } }, events: { select: { eventType: true } } } });
    if (!assignment) throw new DriverEarningError("DRIVER_EARNING_ASSIGNMENT_INVALID", "Authoritative assignment was not found.");
    assertAuthoritativeAssignment(assignmentEvidence(assignment), snapshot);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id"=${snapshot.paymentId} FOR UPDATE`);
    const payment = await tx.payment.findUnique({ where: { id: snapshot.paymentId }, include: paymentInclude });
    let marketplaceFunding = false;
    if (payment?.subjectType === "MARKETPLACE_CHECKOUT") {
      const bridge = await tx.marketplaceStoreOrderDeliveryBridge.findUnique({ where: { courierOrderId: snapshot.orderId }, include: { courierOrder: { include: { cashOnDelivery: true } }, storeOrder: { include: { checkoutStoreGroup: true, marketplaceOrder: true } } } });
      const parent = bridge?.storeOrder.marketplaceOrder;
      const group = bridge?.storeOrder.checkoutStoreGroup;
      if (!bridge || !parent || !group || payment.orderId !== null || payment.marketplaceOrderId !== parent.id || payment.marketplaceCheckoutId !== parent.checkoutId || parent.paymentId !== payment.id || group.deliveryQuoteReference !== bridge.courierOrder.pricingQuoteId || !group.deliveryFee.equals(snapshot.driverSettlementBasisAmount) || bridge.courierOrder.orderNumber !== snapshot.orderPublicReference) throw new DriverEarningError("DRIVER_EARNING_PAYMENT_INVALID", "Marketplace driver funding requires the canonical courier bridge and frozen delivery fee allocation.");
      assertMarketplaceDigitalReceipt(payment, parent.digitalRequired.toFixed(2));
      if (parent.cashRequired.gt(0)) {
        const plan = parseMarketplacePaymentPlan(group.paymentPlan);
        const cod = bridge.courierOrder.cashOnDelivery;
        if (plan.mode !== "DEPOSIT_PLUS_COD" || !cod || cod.status !== "RECONCILED" || cod.paymentId !== payment.id || !cod.digitalRequired.equals(plan.digitalRequired) || !cod.digitalPaid.equals(cod.digitalRequired) || !cod.cashObligation.equals(plan.cashRequired) || !cod.cashCollected.equals(cod.cashObligation) || !cod.cashReconciled.equals(cod.cashObligation) || !cod.remittanceDiscrepancy.isZero() || !parent.grandTotal.equals(plan.authoritativeTotal)) throw new DriverEarningError("DRIVER_EARNING_PAYMENT_INVALID", "Marketplace cash driver earnings await exact source collection and verified remittance.");
        await assertMarketplaceCashJournals(tx, cod);
      } else if (!parent.digitalRequired.equals(parent.grandTotal)) throw new DriverEarningError("DRIVER_EARNING_PAYMENT_INVALID", "Marketplace delivery fee has no full source funding.");
      marketplaceFunding = true;
    }
    assertPayment(payment, snapshot, marketplaceFunding);
    if (!marketplaceFunding) {
      const receipt = payment.successLedgerJournal;
      const gross = new Prisma.Decimal(snapshot.driverSettlementBasisAmount);
      const cod = await tx.cashOnDelivery.findUnique({ where: { orderId: snapshot.orderId } });
      const expected = cod ? cod.digitalRequired : gross;
      if (cod) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "id"=${cod.id} FOR UPDATE`);
        if (cod.status !== "RECONCILED" || cod.paymentId !== payment.id || cod.currency !== "ZAR" || !cod.authoritativePayable.equals(gross) || !cod.digitalPaid.equals(cod.digitalRequired) || !cod.digitalRequired.add(cod.cashObligation).equals(gross) || !cod.cashCollected.equals(cod.cashObligation) || !cod.cashReconciled.equals(cod.cashObligation) || !cod.remittanceDiscrepancy.isZero()) throw new DriverEarningError("DRIVER_EARNING_PAYMENT_INVALID", "Courier cash requires exact collection and verified bank remittance.");
        await assertMarketplaceCashJournals(tx, cod);
      }
      const heldCredit = receipt.entries.filter((entry: any) => entry.direction === "CREDIT" && entry.account.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR").reduce((sum: Prisma.Decimal, entry: any) => sum.add(entry.amount), new Prisma.Decimal(0));
      if (!payment.amount.equals(expected) || receipt.currency !== "ZAR" || !receipt.totalDebits.equals(expected) || !receipt.totalCredits.equals(expected) || !heldCredit.equals(expected)) throw new DriverEarningError("DRIVER_EARNING_PAYMENT_INVALID", "Courier earning requires its exact fully funded source receipt.");
    }
    const ids = snapshot.commissionCharges.map((row) => row.commissionAllocationId).sort();
    if (ids.length) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CommissionAllocation" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
    const allocations = ids.length ? await tx.commissionAllocation.findMany({ where: { id: { in: ids } }, include: { accrual: { select: { subjectType: true, subjectId: true, status: true } } }, orderBy: { id: "asc" } }) : [];
    if (allocations.some((row: any) => row.accrual.subjectType !== "COURIER_ORDER" || row.accrual.subjectId !== snapshot.orderId || row.currency !== "ZAR" || row.downstreamReleaseJournalId)) throw new DriverEarningError("DRIVER_EARNING_COMMISSION_INVALID", "Commission allocation is unrelated or downstream-released.");
    assertDriverCommissionAttribution(snapshot.commissionCharges, allocations.map((row: any) => ({ ...row, accrualStatus: row.accrual.status })));
    const duplicate = await tx.driverEarning.findFirst({ where: { subjectType: snapshot.subjectType, subjectId: snapshot.subjectId, assignmentId: snapshot.assignmentId, driverId: snapshot.driverId, settlementVersion: snapshot.settlementVersion }, select: { id: true } });
    if (duplicate) throw new DriverEarningError("DRIVER_EARNING_SETTLEMENT_ALREADY_ACCRUED", "This assignment, driver, and settlement version is already accrued.");
    const accounts = await resolveDriverEarningAccountsWithinTransaction(tx, { driverId: snapshot.driverId, walletId: snapshot.walletId, payableAccountId: provisioned.account.id });
    const held = await tx.ledgerAccount.findFirst({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
    const amount = new Prisma.Decimal(snapshot.netDriverEarningAmount); if (!held || held.currentBalance.lessThan(amount)) throw new DriverEarningError("DRIVER_EARNING_INSUFFICIENT_HELD_FUNDS", "Customer funds held are insufficient.");
    const journal = await postLedgerJournalWithinTransaction(tx, driverEarningAccrualPosting({ earningReference, amount: snapshot.netDriverEarningAmount, customerFundsHeldAccountId: held.id, driverPayableAccountId: accounts.payable.id, driverPublicReference: snapshot.driverPublicReference, assignmentPublicReference: snapshot.assignmentPublicReference, assignmentVersion: snapshot.assignmentVersion, orderPublicReference: snapshot.orderPublicReference, settlementVersion: snapshot.settlementVersion, completionEvidenceReference: snapshot.completionEvidenceReference, actorUserId: command.actorUserId }));
    for (const charge of snapshot.commissionCharges) await tx.commissionAllocation.update({ where: { id: charge.commissionAllocationId }, data: { driverAttributedAmount: { increment: new Prisma.Decimal(charge.amount) } } });
    return tx.driverEarning.create({ data: { publicReference: earningReference, driverId: snapshot.driverId, driverPublicReference: snapshot.driverPublicReference, walletId: snapshot.walletId, payableAccountId: accounts.payable.id, subjectType: snapshot.subjectType, subjectId: snapshot.subjectId, subjectPublicReference: snapshot.subjectPublicReference, assignmentId: snapshot.assignmentId, assignmentPublicReference: snapshot.assignmentPublicReference, assignmentVersion: snapshot.assignmentVersion, orderId: snapshot.orderId, orderPublicReference: snapshot.orderPublicReference, paymentId: snapshot.paymentId, paymentPublicReference: snapshot.paymentPublicReference, settlementReference: snapshot.settlementReference, settlementVersion: snapshot.settlementVersion, calculationVersion: snapshot.calculationVersion, completionEvidenceReference: snapshot.completionEvidenceReference, serviceCompletedAt: new Date(snapshot.serviceCompletedAt), authoritativeAt: new Date(snapshot.authoritativeAt), releaseEligibleAt: snapshot.releaseEligibleAt ? new Date(snapshot.releaseEligibleAt) : null, settlementBasisAmount: new Prisma.Decimal(snapshot.driverSettlementBasisAmount), attributedCommissionAmount: new Prisma.Decimal(snapshot.attributedCommissionAmount), amount, currency: "ZAR", status: "ACCRUED", creationIdempotencyKey: command.operationId, creationRequestHash: calculationHash, calculationHash, accrualLedgerJournalId: journal.id, commissionCharges: { create: snapshot.commissionCharges.map((charge) => ({ publicReference: ref("DEC"), commissionAllocationId: charge.commissionAllocationId, amount: new Prisma.Decimal(charge.amount), currency: "ZAR" })) }, statusHistory: { create: [{ fromStatus: null, toStatus: "ACCRUED", actorType: command.actorUserId ? "USER" : "SYSTEM", actorId: command.actorUserId ?? null, reasonCode: "ACCRUAL_POSTED", safeMetadata: { ledgerReference: journal.reference, settlementReference: snapshot.settlementReference } }, { fromStatus: null, toStatus: "ACCRUED", actorType: "SYSTEM", reasonCode: "COMMISSION_CHARGES_ATTRIBUTED", safeMetadata: { chargeCount: String(snapshot.commissionCharges.length) } }] } }, include: journalInclude });
}

export async function accrueDriverEarning(command: DriverEarningAccrualCommand, options?: Readonly<{ allowTestOnlyBypass?: boolean }>) {
  assertDriverEarningsProductionReady(options);
  if (!OPERATION.test(command.operationId)) throw new DriverEarningError("DRIVER_EARNING_INVALID_COMMAND", "A valid internal operation ID is required.");
  const snapshot = validateDriverSettlementSnapshot(command.snapshot); const calculationHash = hashDriverEarningCalculation(snapshot);
  const provisioned = await ensureDriverEarningPayableAccount(snapshot.driverId);
  if (provisioned.driver.publicReference !== snapshot.driverPublicReference || provisioned.wallet.id !== snapshot.walletId) throw new DriverEarningError("DRIVER_EARNING_ACCOUNT_INVALID", "Snapshot driver wallet does not match the canonical owner.");
  const run = () => db.$transaction((tx: Prisma.TransactionClient) => accrueDriverEarningInTransaction(tx, command, provisioned), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  try { return dto(await withLedgerRetry(run)); } catch (error) { const winner = await db.driverEarning.findUnique({ where: { creationIdempotencyKey: command.operationId }, include: journalInclude }); if (winner && winner.creationRequestHash === calculationHash) return dto(winner); throw error; }
}
