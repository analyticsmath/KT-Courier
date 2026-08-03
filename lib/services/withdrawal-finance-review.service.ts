import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { lockWithdrawalAccounts } from "./withdrawal-account.service";
import { withdrawalReleasePosting } from "@/lib/withdrawals/withdrawal-ledger-policy";
import { assertWithdrawalTransition } from "@/lib/withdrawals/withdrawal-state-machine";
import { resolveWithdrawalOwnerForUser } from "@/lib/withdrawals/withdrawal-owner-policy";
import { WithdrawalError } from "@/lib/withdrawals/errors";
import { withLedgerRetry } from "@/lib/ledger/retry";

async function lockWithdrawal(tx: Prisma.TransactionClient, publicReference: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "WithdrawalRequest" WHERE "withdrawalNumber" = ${publicReference} FOR UPDATE`);
  if (locked.length !== 1) throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", "Withdrawal request was not found.");
  const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: locked[0].id }, include: { payoutDestination: true } });
  if (!withdrawal) throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", "Withdrawal request was not found.");
  return withdrawal;
}

async function assertFinanceDecisionCoherence(tx: Prisma.TransactionClient, withdrawal: Awaited<ReturnType<typeof lockWithdrawal>>) {
  if (withdrawal.releaseLedgerJournalId || withdrawal.payoutLedgerJournalId || !withdrawal.reserveLedgerJournalId) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Withdrawal financial evidence is not coherent for a finance decision.");
  }
  if (withdrawal.payoutDestination.status !== "ACTIVE") throw new WithdrawalError("WITHDRAWAL_DESTINATION_INACTIVE", "The payout destination is no longer active.");
  const owner = await resolveWithdrawalOwnerForUser(tx, withdrawal.requestedByUserId);
  if (owner.ownerType !== withdrawal.ownerType || owner.ownerId !== withdrawal.ownerId) {
    throw new WithdrawalError("WITHDRAWAL_OWNER_INELIGIBLE", "Withdrawal ownership no longer matches the owner relationship.");
  }
}

export async function beginWithdrawalReview(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string }>) {
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const withdrawal = await lockWithdrawal(tx, input.publicReference);
    assertWithdrawalTransition(withdrawal.status, "UNDER_REVIEW");
    await assertFinanceDecisionCoherence(tx, withdrawal);
    const updated = await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "UNDER_REVIEW", version: { increment: 1 } } });
    await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, fromStatus: withdrawal.status, toStatus: "UNDER_REVIEW", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, reasonCode: "FINANCE_REVIEW_STARTED" } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function approveWithdrawal(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string }>) {
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const withdrawal = await lockWithdrawal(tx, input.publicReference);
    if (withdrawal.requestedByUserId === input.actorUserId) throw new WithdrawalError("WITHDRAWAL_DUAL_CONTROL_REQUIRED", "The requester cannot approve their own withdrawal.");
    assertWithdrawalTransition(withdrawal.status, "APPROVED");
    await assertFinanceDecisionCoherence(tx, withdrawal);
    const updated = await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "APPROVED", approvedByUserId: input.actorUserId, approvedAt: new Date(), version: { increment: 1 } } });
    await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, fromStatus: withdrawal.status, toStatus: "APPROVED", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, reasonCode: "FINANCE_APPROVED" } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function rejectWithdrawal(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string; reasonCode: string }>) {
  const reasonCode = input.reasonCode.trim();
  if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(reasonCode)) throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", "A bounded safe rejection reason code is required.");
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const withdrawal = await lockWithdrawal(tx, input.publicReference);
    if (withdrawal.requestedByUserId === input.actorUserId) throw new WithdrawalError("WITHDRAWAL_DUAL_CONTROL_REQUIRED", "The requester cannot reject their own withdrawal.");
    assertWithdrawalTransition(withdrawal.status, "REJECTED");
    await assertFinanceDecisionCoherence(tx, withdrawal);
    await lockWithdrawalAccounts(tx, withdrawal);
    const release = await postLedgerJournalWithinTransaction(tx, withdrawalReleasePosting({ withdrawalReference: withdrawal.publicReference, amount: withdrawal.amount.toFixed(2), sourceAccountId: withdrawal.sourceAccountId, heldAccountId: withdrawal.heldAccountId, actorUserId: input.actorUserId, payoutDestinationReference: withdrawal.payoutDestination.publicReference, ownerType: withdrawal.ownerType, policyVersion: withdrawal.policyVersion }));
    const updated = await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "REJECTED", rejectedByUserId: input.actorUserId, rejectedAt: new Date(), rejectionReasonCode: reasonCode, releaseLedgerJournalId: release.id, version: { increment: 1 } } });
    await tx.withdrawalStatusHistory.createMany({ data: [
      { withdrawalId: withdrawal.id, fromStatus: withdrawal.status, toStatus: "REJECTED", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, reasonCode },
      { withdrawalId: withdrawal.id, toStatus: "REJECTED", actorType: "SYSTEM", reasonCode: "RESERVATION_RELEASED", safeMetadata: { releaseJournalReference: release.reference } },
    ] });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
