import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const reference = () => `SERC-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const staleBefore = new Date(Date.now() - 30 * 24 * 60 * 60_000);

async function observe(tx, earning, reason, summary, priority = "HIGH") {
  const caseKey = `store-earning:${earning.publicReference}:${reason}`;
  await tx.storeEarningReconciliationCase.upsert({ where: { caseKey }, create: { publicReference: reference(), caseKey, storeEarningId: earning.id, reason, priority, safeSummary: summary }, update: { status: "OPEN", observationCount: { increment: 1 }, lastObservedAt: new Date(), priority, safeSummary: summary } });
}

async function main() {
  const rows = await prisma.storeEarning.findMany({ include: { accrualLedgerJournal: true, releaseLedgerJournal: true, reversalLedgerJournal: true, payableAccount: true, commissionCharges: { include: { commissionAllocation: true } }, fundingAllocations: { include: { refund: true } } } });
  const chargesByAllocation = new Map();
  const earningsByPayable = new Map();
  const settlementIdentities = new Map();
  for (const earning of rows) {
    const identity = `${earning.subjectType}:${earning.subjectId}:${earning.storeId}:${earning.settlementVersion}`;
    settlementIdentities.set(identity, [...(settlementIdentities.get(identity) ?? []), earning]);
    earningsByPayable.set(earning.payableAccountId, [...(earningsByPayable.get(earning.payableAccountId) ?? []), earning]);
    for (const charge of earning.commissionCharges) chargesByAllocation.set(charge.commissionAllocationId, (chargesByAllocation.get(charge.commissionAllocationId) ?? new Prisma.Decimal(0)).add(charge.amount));
  }
  let observations = 0;
  await prisma.$transaction(async (tx) => {
    for (const earning of rows) {
      const chargeTotal = earning.commissionCharges.reduce((sum, charge) => sum.add(charge.amount), new Prisma.Decimal(0));
      if (!earning.accrualLedgerJournal || earning.accrualLedgerJournal.type !== "STORE_EARNING_ACCRUAL") { await observe(tx, earning, "LEDGER_LINK_MISSING", "Store earning accrual journal link is missing or invalid.", "CRITICAL"); observations += 1; }
      else if (!earning.accrualLedgerJournal.totalDebits.equals(earning.amount) || !earning.accrualLedgerJournal.totalCredits.equals(earning.amount)) { await observe(tx, earning, "LEDGER_AMOUNT_MISMATCH", "Store earning accrual journal totals differ from the immutable earning amount.", "CRITICAL"); observations += 1; }
      if (earning.status === "RELEASED" && (!earning.releaseLedgerJournal || earning.releaseLedgerJournal.type !== "STORE_EARNING_RELEASE")) { await observe(tx, earning, "LEDGER_LINK_MISSING", "Released store earning has no canonical release journal.", "CRITICAL"); observations += 1; }
      if (earning.status === "REVERSED" && (!earning.reversalLedgerJournal || earning.reversalLedgerJournal.type !== "STORE_EARNING_REVERSAL")) { await observe(tx, earning, "LEDGER_LINK_MISSING", "Reversed store earning has no canonical reversal journal.", "CRITICAL"); observations += 1; }
      if (!chargeTotal.equals(earning.attributedCommissionAmount)) { await observe(tx, earning, "COMMISSION_ATTRIBUTION_MISMATCH", "Commission charge total differs from the immutable attributed commission amount."); observations += 1; }
      if (earning.commissionCharges.some((charge) => charge.commissionAllocation.storeAttributedAmount.greaterThan(charge.commissionAllocation.amount) || !(chargesByAllocation.get(charge.commissionAllocationId) ?? new Prisma.Decimal(0)).equals(charge.commissionAllocation.storeAttributedAmount))) { await observe(tx, earning, "COMMISSION_OVER_ATTRIBUTION", "Commission attribution projection is over-attributed or differs from charge evidence.", "CRITICAL"); observations += 1; }
      const reservedStatuses = new Set(["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "RECONCILIATION_REQUIRED"]);
      const fundingReserved = earning.fundingAllocations.filter((allocation) => reservedStatuses.has(allocation.refund.status)).reduce((sum, allocation) => sum.add(allocation.amount), new Prisma.Decimal(0));
      const fundingRefunded = earning.fundingAllocations.filter((allocation) => allocation.refund.status === "SUCCEEDED").reduce((sum, allocation) => sum.add(allocation.amount), new Prisma.Decimal(0));
      if (!fundingReserved.equals(earning.refundReservedAmount) || !fundingRefunded.equals(earning.refundedAmount)) { await observe(tx, earning, "REFUND_ADJUSTMENT_MISMATCH", "Store earning refund projections differ from authoritative funding allocations.", "CRITICAL"); observations += 1; }
      if ((earning.status === "ACCRUED" || earning.status === "RECONCILIATION_REQUIRED") && earning.createdAt < staleBefore) { await observe(tx, earning, "STALE_ACCRUAL", "Store earning remains unreleased beyond the reconciliation threshold.", "MEDIUM"); observations += 1; }
      if (earning.status === "RELEASED" && (!earning.refundReservedAmount.isZero() || earning.fundingAllocations.some((allocation) => reservedStatuses.has(allocation.refund.status)))) { await observe(tx, earning, "REFUND_AFTER_RELEASE", "Released store earning retains or received active refund funding exposure.", "CRITICAL"); observations += 1; }
      if (earning.status === "RELEASED" && (!earning.releaseEligibleAt || !earning.releasedAt || earning.releasedAt < earning.releaseEligibleAt)) { await observe(tx, earning, "APPLICATION_FAILURE", "Release evidence predates or lacks authoritative release eligibility.", "CRITICAL"); observations += 1; }
    }
    for (const duplicates of settlementIdentities.values()) if (duplicates.length > 1) for (const earning of duplicates) { await observe(tx, earning, "DUPLICATE_STORE_SETTLEMENT", "More than one earning has the same subject, store and settlement version.", "CRITICAL"); observations += 1; }
    for (const earnings of earningsByPayable.values()) {
      const expected = earnings.reduce((sum, earning) => sum.add(earning.amount).sub(earning.refundReservedAmount).sub(earning.refundedAmount).sub(earning.releasedAmount).sub(earning.reversedAmount), new Prisma.Decimal(0));
      if (!expected.equals(earnings[0].payableAccount.currentBalance)) for (const earning of earnings) { await observe(tx, earning, "RELEASE_BALANCE_MISMATCH", "Store payable account projection differs from earning-level entitlement projections.", "CRITICAL"); observations += 1; }
    }
  }, { isolationLevel: "Serializable" });
  console.log(`Store earning reconciliation scan recorded ${observations} observations.`);
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Store earning reconciliation scan failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
