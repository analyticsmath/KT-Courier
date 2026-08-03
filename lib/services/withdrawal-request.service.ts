import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerMoney } from "@/lib/ledger/money";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { lockWithdrawalAccounts } from "./withdrawal-account.service";
import { assertWithdrawalPolicy } from "@/lib/withdrawals/withdrawal-policy";
import { withdrawalCreationHash } from "@/lib/withdrawals/withdrawal-idempotency";
import { withdrawalReservePosting, withdrawalReleasePosting } from "@/lib/withdrawals/withdrawal-ledger-policy";
import { resolveWithdrawalOwnerForUser } from "@/lib/withdrawals/withdrawal-owner-policy";
import { assertWithdrawalProductionActivation } from "@/lib/withdrawals/withdrawal-production-readiness";
import { parseWithdrawalAmount } from "@/lib/withdrawals/withdrawal-money-policy";
import { WithdrawalError } from "@/lib/withdrawals/errors";
import { withLedgerRetry } from "@/lib/ledger/retry";

function withdrawalReference(): string {
  return `WD-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

async function lockWithdrawalCreationContext(tx: Prisma.TransactionClient, walletId: string): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Wallet" WHERE "id" = ${walletId} FOR UPDATE`,
  );
}

async function findCreationReceipt(tx: Prisma.TransactionClient, operationId: string, requestHash: string) {
  const existing = await tx.withdrawalRequest.findUnique({ where: { creationIdempotencyKey: operationId } });
  if (!existing) return null;
  if (existing.creationRequestHash !== requestHash) {
    throw new WithdrawalError("WITHDRAWAL_IDEMPOTENCY_CONFLICT", "The operation ID is already associated with a different withdrawal request.");
  }
  return existing;
}

export async function createWithdrawalRequest(input: Readonly<{
  actorUserId: string;
  amount: string;
  payoutDestinationPublicReference: string;
  operationId: string;
}>) {
  assertWithdrawalProductionActivation();
  const amount = parseWithdrawalAmount(input.amount);
  const operationId = input.operationId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(operationId)) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", "A valid operation ID is required.");
  }

  let expectedRequestHash: string | null = null;
  const run = () => prisma.$transaction(async (tx) => {
    const owner = await resolveWithdrawalOwnerForUser(tx, input.actorUserId);
    const wallet = await tx.wallet.findUnique({
      where: { ownerType_ownerId_currency: { ownerType: owner.ownerType, ownerId: owner.ownerId, currency: "ZAR" } },
      select: { id: true, status: true },
    });
    if (!wallet || wallet.status !== "ACTIVE") throw new WithdrawalError("WITHDRAWAL_OWNER_INELIGIBLE", "An active owner wallet is required.");
    const policy = await tx.withdrawalPolicy.findUnique({ where: { ownerType_currency: { ownerType: owner.ownerType, currency: "ZAR" } } });
    if (!policy) throw new WithdrawalError("WITHDRAWAL_POLICY_DISABLED", "No withdrawal policy is available for this owner type.");
    assertWithdrawalPolicy({ enabled: policy.enabled, ownerType: policy.ownerType, currency: policy.currency, minimumAmount: policy.minimumAmount?.toFixed(2) ?? null, maximumAmount: policy.maximumAmount?.toFixed(2) ?? null, amount: amount.toString() });
    const destination = await tx.payoutDestination.findUnique({ where: { publicReference: input.payoutDestinationPublicReference }, select: { id: true, publicReference: true, walletId: true, ownerType: true, ownerId: true, currency: true, status: true } });
    if (!destination || destination.walletId !== wallet.id || destination.ownerType !== owner.ownerType || destination.ownerId !== owner.ownerId || destination.currency !== "ZAR") {
      throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "The payout destination does not belong to this owner wallet.");
    }
    if (destination.status !== "ACTIVE") throw new WithdrawalError("WITHDRAWAL_DESTINATION_INACTIVE", "The selected payout destination is not active.");
    const requestHash = withdrawalCreationHash({ ownerType: owner.ownerType, ownerId: owner.ownerId, walletId: wallet.id, amount: amount.toString(), currency: "ZAR", payoutDestinationId: destination.id, policyVersion: policy.version });
    expectedRequestHash = requestHash;
    const existing = await findCreationReceipt(tx, operationId, requestHash);
    if (existing) return existing;

    await lockWithdrawalCreationContext(tx, wallet.id);
    const accounts = await tx.ledgerAccount.findMany({ where: { walletId: wallet.id, currency: "ZAR", purpose: { in: ["OWNER_WITHDRAWABLE", "WITHDRAWAL_HELD"] } }, select: { id: true, purpose: true } });
    const sourceAccountId = accounts.find((account) => account.purpose === "OWNER_WITHDRAWABLE")?.id;
    const heldAccountId = accounts.find((account) => account.purpose === "WITHDRAWAL_HELD")?.id;
    if (!sourceAccountId || !heldAccountId) throw new WithdrawalError("WITHDRAWAL_ACCOUNT_INVALID", "The owner withdrawal accounts are not provisioned.");
    const locked = await lockWithdrawalAccounts(tx, { walletId: wallet.id, sourceAccountId, heldAccountId });
    if (LedgerMoney.fromDecimal(locked.source.currentBalance).lessThan(amount)) {
      throw new WithdrawalError("WITHDRAWAL_INSUFFICIENT_BALANCE", "The requested amount exceeds the withdrawable balance.");
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (policy.dailyMaximumAmount) {
      const requestedToday = await tx.withdrawalRequest.aggregate({ where: { walletId: wallet.id, createdAt: { gte: today } }, _sum: { amount: true } });
      const total = LedgerMoney.fromDecimal(requestedToday._sum.amount ?? new Prisma.Decimal(0)).add(amount);
      if (total.greaterThan(LedgerMoney.fromDecimal(policy.dailyMaximumAmount))) throw new WithdrawalError("WITHDRAWAL_POLICY_LIMIT", "The daily withdrawal policy limit would be exceeded.");
    }
    const openRestriction = await tx.withdrawalReconciliationCase.count({ where: { withdrawal: { walletId: wallet.id }, status: { in: ["OPEN", "MONITORING"] } } });
    if (openRestriction > 0) throw new WithdrawalError("WITHDRAWAL_OWNER_INELIGIBLE", "An unresolved finance restriction prevents a new withdrawal request.");

    const publicReference = withdrawalReference();
    const reserve = await postLedgerJournalWithinTransaction(tx, withdrawalReservePosting({ withdrawalReference: publicReference, amount: amount.toString(), sourceAccountId, heldAccountId, actorUserId: input.actorUserId, payoutDestinationReference: destination.publicReference, ownerType: owner.ownerType, policyVersion: policy.version }));
    const withdrawal = await tx.withdrawalRequest.create({
      data: { publicReference, walletId: wallet.id, ownerType: owner.ownerType, ownerId: owner.ownerId, sourceAccountId, heldAccountId, payoutDestinationId: destination.id, amount: amount.toDecimal(), currency: "ZAR", status: "REQUESTED", creationIdempotencyKey: operationId, creationRequestHash: requestHash, policyVersion: policy.version, reserveLedgerJournalId: reserve.id, requestedByUserId: input.actorUserId },
    });
    await tx.withdrawalStatusHistory.createMany({ data: [
      { withdrawalId: withdrawal.id, toStatus: "REQUESTED", actorType: "OWNER", actorUserId: input.actorUserId, reasonCode: "WITHDRAWAL_REQUESTED" },
      { withdrawalId: withdrawal.id, toStatus: "REQUESTED", actorType: "SYSTEM", reasonCode: "FUNDS_RESERVED", safeMetadata: { reserveJournalReference: reserve.reference } },
    ] });
    return withdrawal;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  try { return await withLedgerRetry(run); }
  catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
    const existing = await prisma.withdrawalRequest.findUnique({ where: { creationIdempotencyKey: operationId } });
    if (!existing) throw error;
    if (expectedRequestHash && existing.creationRequestHash === expectedRequestHash) return existing;
    throw new WithdrawalError("WITHDRAWAL_IDEMPOTENCY_CONFLICT", "The operation ID is already associated with a different withdrawal request.");
  }
}

export async function cancelWithdrawalRequest(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string }>) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(input.operationId.trim())) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", "A valid operation ID is required.");
  }
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "WithdrawalRequest" WHERE "withdrawalNumber" = ${input.publicReference} FOR UPDATE`);
    if (lockedRows.length !== 1) throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", "Withdrawal request was not found.");
    const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: lockedRows[0].id }, include: { payoutDestination: true } });
    if (!withdrawal || withdrawal.requestedByUserId !== input.actorUserId) throw new WithdrawalError("WITHDRAWAL_FORBIDDEN", "This withdrawal request does not belong to the current owner.");
    if (withdrawal.status !== "REQUESTED" && withdrawal.status !== "UNDER_REVIEW") throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "This withdrawal cannot be cancelled.");
    if (withdrawal.releaseLedgerJournalId || withdrawal.payoutLedgerJournalId) throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "This withdrawal already has irreversible financial evidence.");
    await lockWithdrawalAccounts(tx, withdrawal);
    const release = await postLedgerJournalWithinTransaction(tx, withdrawalReleasePosting({ withdrawalReference: withdrawal.publicReference, amount: withdrawal.amount.toFixed(2), sourceAccountId: withdrawal.sourceAccountId, heldAccountId: withdrawal.heldAccountId, actorUserId: input.actorUserId, payoutDestinationReference: withdrawal.payoutDestination.publicReference, ownerType: withdrawal.ownerType, policyVersion: withdrawal.policyVersion }));
    const updated = await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "CANCELLED", releaseLedgerJournalId: release.id, cancelledByUserId: input.actorUserId, cancelledAt: new Date(), cancellationReasonCode: "OWNER_CANCELLED", version: { increment: 1 } } });
    await tx.withdrawalStatusHistory.createMany({ data: [
      { withdrawalId: withdrawal.id, fromStatus: withdrawal.status, toStatus: "CANCELLED", actorType: "OWNER", actorUserId: input.actorUserId, reasonCode: "OWNER_CANCELLED" },
      { withdrawalId: withdrawal.id, toStatus: "CANCELLED", actorType: "SYSTEM", reasonCode: "RESERVATION_RELEASED", safeMetadata: { releaseJournalReference: release.reference } },
    ] });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
