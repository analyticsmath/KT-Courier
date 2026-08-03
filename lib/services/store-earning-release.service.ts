import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { storeEarningReleasePosting } from "@/lib/store-earnings/store-earning-ledger-policy";
import { formatStoreEarningMoney } from "@/lib/store-earnings/store-earning-money";
import { STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED, assertStoreEarningsProductionReady } from "@/lib/store-earnings/store-earning-production-readiness";
import { assertStoreEarningReleaseEligible } from "@/lib/store-earnings/store-earning-release-policy";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";

const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;

export async function releaseStoreEarning(input: Readonly<{ earningId: string; operationId: string; actorUserId?: string; now?: Date }>, options?: Readonly<{ allowTestOnlyBypass?: boolean }>) {
  assertStoreEarningsProductionReady(options);
  if (!OPERATION_ID.test(input.operationId)) throw new StoreEarningError("STORE_EARNING_INVALID_COMMAND", "A valid internal release operation ID is required.");
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "StoreEarning" WHERE "id" = ${input.earningId} FOR UPDATE`);
    if (locked.length !== 1) throw new StoreEarningError("STORE_EARNING_NOT_FOUND", "Store earning was not found.");
    const earning = await tx.storeEarning.findUnique({
      where: { id: input.earningId },
      include: {
        store: { select: { status: true } }, payableAccount: true,
        wallet: { include: { accounts: { where: { purpose: "OWNER_WITHDRAWABLE", currency: "ZAR" } } } },
        releaseLedgerJournal: { select: { reference: true } },
        reconciliationCases: { select: { status: true } },
        fundingAllocations: { include: { refund: { include: { reconciliationCases: { select: { status: true } } } } } },
        commissionCharges: { select: { amount: true, commissionAllocationId: true } },
        payment: { include: { reconciliationCases: { select: { status: true } } } },
      },
    });
    if (!earning) throw new StoreEarningError("STORE_EARNING_NOT_FOUND", "Store earning was not found.");
    if (earning.status === "RELEASED" && earning.releaseLedgerJournal) return Object.freeze({ publicReference: earning.publicReference, status: earning.status, releasedAmount: formatStoreEarningMoney(earning.releasedAmount), releaseLedgerJournalReference: earning.releaseLedgerJournal.reference, idempotent: true });

    const allocationIds = earning.commissionCharges.map((charge) => charge.commissionAllocationId).sort();
    if (allocationIds.length) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CommissionAllocation" WHERE "id" IN (${Prisma.join(allocationIds)}) ORDER BY "id" ASC FOR UPDATE`);
    const allocations = allocationIds.length ? await tx.commissionAllocation.findMany({ where: { id: { in: allocationIds } }, select: { id: true, amount: true, storeAttributedAmount: true, status: true, accrual: { select: { status: true } } }, orderBy: { id: "asc" } }) : [];
    const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));

    const remaining = earning.amount.sub(earning.refundedAmount).sub(earning.reversedAmount).sub(earning.releasedAmount);
    const ownerWithdrawable = earning.wallet.accounts.find((account) => account.status === "ACTIVE" && account.category === "LIABILITY" && !account.allowNegative);
    const chargeTotal = earning.commissionCharges.reduce((sum, charge) => sum.add(charge.amount), new Prisma.Decimal(0));
    const commissionCoherent = allocations.length === allocationIds.length && chargeTotal.equals(earning.attributedCommissionAmount) && earning.commissionCharges.every((charge) => { const allocation = allocationById.get(charge.commissionAllocationId); return Boolean(allocation && allocation.status === "ACCRUED" && allocation.accrual.status === "ACCRUED" && allocation.storeAttributedAmount.greaterThanOrEqualTo(charge.amount) && charge.amount.lessThanOrEqualTo(allocation.amount)); });
    const openStatus = (status: string) => status === "OPEN" || status === "MONITORING";
    const hasRefundCase = earning.fundingAllocations.some((allocation) => allocation.refund.reconciliationCases.some((record) => openStatus(record.status)));
    const hasPaymentConflict = earning.payment.reconciliationStatus !== "CLEAR" || earning.payment.reconciliationCases.some((record) => openStatus(record.status));
    assertStoreEarningReleaseEligible({
      status: earning.status,
      productionValidationApproved: STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED || options?.allowTestOnlyBypass === true,
      releaseEligibleAt: earning.releaseEligibleAt,
      now: input.now ?? new Date(),
      refundReservedAmount: earning.refundReservedAmount,
      remainingAmount: remaining,
      hasOpenEarningReconciliation: earning.reconciliationCases.some((record) => openStatus(record.status)),
      hasOpenRefundReconciliation: hasRefundCase,
      commissionAttributionCoherent: commissionCoherent,
      hasPaymentConflict,
      activeStore: earning.store.status === "ACTIVE" && earning.wallet.status === "ACTIVE",
      validOwnerWithdrawableAccount: Boolean(ownerWithdrawable),
      validStorePayableAccount: earning.payableAccount.status === "ACTIVE" && earning.payableAccount.category === "LIABILITY" && earning.payableAccount.purpose === "STORE_EARNINGS_PAYABLE" && !earning.payableAccount.allowNegative,
      releaseLedgerJournalId: earning.releaseLedgerJournalId,
      reversalLedgerJournalId: earning.reversalLedgerJournalId,
    });
    if (!ownerWithdrawable || earning.payableAccount.currentBalance.lessThan(remaining)) throw new StoreEarningError("STORE_EARNING_RELEASE_NOT_ELIGIBLE", "Store payable balance cannot fund the exact remaining release.");
    const amount = formatStoreEarningMoney(remaining);
    const journal = await postLedgerJournalWithinTransaction(tx, storeEarningReleasePosting({ earningReference: earning.publicReference, amount, storePayableAccountId: earning.payableAccountId, ownerWithdrawableAccountId: ownerWithdrawable.id, storePublicReference: earning.storePublicReference, subjectPublicReference: earning.subjectPublicReference, settlementVersion: earning.settlementVersion, paymentPublicReference: earning.paymentPublicReference, releaseEligibleAt: earning.releaseEligibleAt!.toISOString(), actorUserId: input.actorUserId }));
    const now = new Date();
    await tx.storeEarning.update({ where: { id: earning.id }, data: { status: "RELEASED", releasedAmount: remaining, releaseLedgerJournalId: journal.id, releasedAt: now, version: { increment: 1 }, statusHistory: { create: { fromStatus: "ACCRUED", toStatus: "RELEASED", actorType: input.actorUserId ? "USER" : "SYSTEM", actorId: input.actorUserId ?? null, reasonCode: "RELEASE_COMPLETED", safeMetadata: { ledgerReference: journal.reference } } } } });
    return Object.freeze({ publicReference: earning.publicReference, status: "RELEASED" as const, releasedAmount: amount, releaseLedgerJournalReference: journal.reference, idempotent: false });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
