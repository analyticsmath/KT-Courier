import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerMoney } from "@/lib/ledger/money";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { payoutAttemptHash, payoutCompletionHash } from "@/lib/withdrawals/withdrawal-idempotency";
import { assertWithdrawalDualControl } from "@/lib/withdrawals/withdrawal-dual-control";
import { withdrawalPayoutPosting } from "@/lib/withdrawals/withdrawal-ledger-policy";
import { assertExternalPayoutReference } from "@/lib/withdrawals/payout-reference-policy";
import { assertPayoutAttemptTransition } from "@/lib/withdrawals/payout-attempt-state-machine";
import { assertWithdrawalTransition } from "@/lib/withdrawals/withdrawal-state-machine";
import { assertWithdrawalProductionActivation } from "@/lib/withdrawals/withdrawal-production-readiness";
import { WithdrawalError } from "@/lib/withdrawals/errors";
import { withLedgerRetry } from "@/lib/ledger/retry";

function payoutAttemptReference(): string { return `WPA-${randomUUID().replaceAll("-", "").toUpperCase()}`; }
function reconciliationReference(): string { return `WRC-${randomUUID().replaceAll("-", "").toUpperCase()}`; }

async function lockWithdrawal(tx: Prisma.TransactionClient, publicReference: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "WithdrawalRequest" WHERE "withdrawalNumber" = ${publicReference} FOR UPDATE`);
  if (locked.length !== 1) throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", "Withdrawal request was not found.");
  const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: locked[0].id }, include: { payoutDestination: true } });
  if (!withdrawal) throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", "Withdrawal request was not found.");
  return withdrawal;
}

async function lockAttempt(tx: Prisma.TransactionClient, withdrawalId: string, publicReference: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "WithdrawalPayoutAttempt" WHERE "publicReference" = ${publicReference} FOR UPDATE`);
  if (locked.length !== 1) throw new WithdrawalError("WITHDRAWAL_PAYOUT_NOT_FOUND", "Withdrawal payout attempt was not found.");
  const attempt = await tx.withdrawalPayoutAttempt.findUnique({ where: { id: locked[0].id } });
  if (!attempt || attempt.withdrawalId !== withdrawalId) throw new WithdrawalError("WITHDRAWAL_PAYOUT_NOT_FOUND", "Withdrawal payout attempt was not found.");
  return attempt;
}

async function openReconciliationCase(
  tx: Prisma.TransactionClient,
  input: Readonly<{ withdrawalId: string; withdrawalReference: string; attemptId?: string; attemptReference?: string; reason: "UNKNOWN_PAYOUT_OUTCOME" | "INSUFFICIENT_CASH_CLEARING" | "CONFLICTING_EXTERNAL_REFERENCE"; summary: string }>,
) {
  const caseKey = `withdrawal:${input.withdrawalReference}:${input.reason}:${input.attemptReference ?? "none"}`;
  const existing = await tx.withdrawalReconciliationCase.findUnique({ where: { caseKey } });
  if (existing) {
    return tx.withdrawalReconciliationCase.update({ where: { id: existing.id }, data: { observationCount: { increment: 1 }, lastObservedAt: new Date() } });
  }
  return tx.withdrawalReconciliationCase.create({ data: { publicReference: reconciliationReference(), caseKey, withdrawalId: input.withdrawalId, payoutAttemptId: input.attemptId, reason: input.reason, priority: input.reason === "INSUFFICIENT_CASH_CLEARING" ? "HIGH" : "HIGH", safeSummary: input.summary } });
}

export async function startWithdrawalPayout(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string }>) {
  const operationId = input.operationId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(operationId)) throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", "A valid operation ID is required.");
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const withdrawal = await lockWithdrawal(tx, input.publicReference);
    if (withdrawal.status !== "APPROVED" || !withdrawal.approvedByUserId) throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Only approved withdrawals can start payout processing.");
    if (withdrawal.requestedByUserId === input.actorUserId) throw new WithdrawalError("WITHDRAWAL_DUAL_CONTROL_REQUIRED", "The requester cannot process their own withdrawal.");
    if (withdrawal.payoutDestination.status !== "ACTIVE") throw new WithdrawalError("WITHDRAWAL_DESTINATION_INACTIVE", "The payout destination is not active.");
    const active = await tx.withdrawalPayoutAttempt.count({ where: { withdrawalId: withdrawal.id, status: { in: ["RESERVED", "PROCESSING", "UNKNOWN"] } } });
    if (active > 0) throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "This withdrawal already has an active payout attempt.");
    const requestHash = payoutAttemptHash({ withdrawalId: withdrawal.id, operationId, actorUserId: input.actorUserId });
    const existing = await tx.withdrawalPayoutAttempt.findUnique({ where: { idempotencyKey: operationId } });
    if (existing) {
      if (existing.requestHash !== requestHash || existing.withdrawalId !== withdrawal.id) throw new WithdrawalError("WITHDRAWAL_IDEMPOTENCY_CONFLICT", "The operation ID belongs to a different payout attempt.");
      return existing;
    }
    const now = new Date();
    const attempt = await tx.withdrawalPayoutAttempt.create({ data: { publicReference: payoutAttemptReference(), withdrawalId: withdrawal.id, attemptNumber: withdrawal.latestAttemptNumber + 1, method: "MANUAL_EXTERNAL", status: "RESERVED", idempotencyKey: operationId, requestHash, initiatedByUserId: input.actorUserId } });
    const processingAttempt = await tx.withdrawalPayoutAttempt.update({ where: { id: attempt.id }, data: { status: "PROCESSING", startedAt: now, version: { increment: 1 } } });
    await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "PROCESSING", latestAttemptNumber: attempt.attemptNumber, currentPayoutAttemptId: attempt.id, version: { increment: 1 } } });
    await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, payoutAttemptId: attempt.id, fromStatus: "APPROVED", toStatus: "PROCESSING", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, reasonCode: "PAYOUT_PROCESSING_STARTED", safeMetadata: { payoutAttemptReference: attempt.publicReference } } });
    return processingAttempt;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function recordWithdrawalPayoutFailure(input: Readonly<{ actorUserId: string; withdrawalPublicReference: string; payoutAttemptPublicReference: string; operationId: string; failureCategory: "OPERATOR_CONFIRMED" | "EXTERNAL_SYSTEM_REJECTED" | "LIQUIDITY_UNAVAILABLE" | "DESTINATION_UNAVAILABLE" | "EVIDENCE_REJECTED" | "OTHER_SAFE_FAILURE"; failureCode: string; safeFailureMessage?: string }>) {
  if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(input.failureCode)) throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", "A safe failure code is required.");
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const withdrawal = await lockWithdrawal(tx, input.withdrawalPublicReference);
    const attempt = await lockAttempt(tx, withdrawal.id, input.payoutAttemptPublicReference);
    if (withdrawal.status !== "PROCESSING" || withdrawal.currentPayoutAttemptId !== attempt.id) throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Withdrawal is not processing this payout attempt.");
    assertPayoutAttemptTransition(attempt.status, "FAILED");
    assertWithdrawalTransition(withdrawal.status, "APPROVED");
    const now = new Date();
    await tx.withdrawalPayoutAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", failureCategory: input.failureCategory, failureCode: input.failureCode, failureMessage: input.safeFailureMessage?.trim().slice(0, 240), failedAt: now, version: { increment: 1 } } });
    const updated = await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "APPROVED", currentPayoutAttemptId: null, version: { increment: 1 } } });
    await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, payoutAttemptId: attempt.id, fromStatus: "PROCESSING", toStatus: "APPROVED", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, reasonCode: "PAYOUT_DEFINITELY_FAILED", safeMetadata: { failureCode: input.failureCode } } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function recordWithdrawalPayoutUnknown(input: Readonly<{ actorUserId: string; withdrawalPublicReference: string; payoutAttemptPublicReference: string; operationId: string; safeEvidenceReference?: string }>) {
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const withdrawal = await lockWithdrawal(tx, input.withdrawalPublicReference);
    const attempt = await lockAttempt(tx, withdrawal.id, input.payoutAttemptPublicReference);
    if (withdrawal.status !== "PROCESSING" || withdrawal.currentPayoutAttemptId !== attempt.id) throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Withdrawal is not processing this payout attempt.");
    assertPayoutAttemptTransition(attempt.status, "UNKNOWN");
    assertWithdrawalTransition(withdrawal.status, "RECONCILIATION_REQUIRED");
    const now = new Date();
    await tx.withdrawalPayoutAttempt.update({ where: { id: attempt.id }, data: { status: "UNKNOWN", safeEvidenceReference: input.safeEvidenceReference?.trim().slice(0, 160), unknownAt: now, version: { increment: 1 } } });
    const updated = await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } } });
    await openReconciliationCase(tx, { withdrawalId: withdrawal.id, withdrawalReference: withdrawal.publicReference, attemptId: attempt.id, attemptReference: attempt.publicReference, reason: "UNKNOWN_PAYOUT_OUTCOME", summary: "Manual external payout outcome could not be established." });
    await tx.withdrawalStatusHistory.createMany({ data: [
      { withdrawalId: withdrawal.id, payoutAttemptId: attempt.id, fromStatus: "PROCESSING", toStatus: "RECONCILIATION_REQUIRED", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, reasonCode: "PAYOUT_OUTCOME_UNKNOWN" },
      { withdrawalId: withdrawal.id, payoutAttemptId: attempt.id, toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", reasonCode: "RECONCILIATION_OPENED" },
    ] });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function completeManualWithdrawalPayout(input: Readonly<{ actorUserId: string; withdrawalPublicReference: string; payoutAttemptPublicReference: string; externalPayoutReference: string; operationId: string; safeEvidenceReference?: string }>) {
  assertWithdrawalProductionActivation();
  const externalReference = assertExternalPayoutReference(input.externalPayoutReference);
  const completionIdempotencyKey = input.operationId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(completionIdempotencyKey)) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", "A valid operation ID is required.");
  }
  const result = await withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const withdrawal = await lockWithdrawal(tx, input.withdrawalPublicReference);
    const attempt = await lockAttempt(tx, withdrawal.id, input.payoutAttemptPublicReference);
    const completionRequestHash = payoutCompletionHash({ withdrawalId: withdrawal.id, attemptId: attempt.id, externalReference, evidenceReference: input.safeEvidenceReference?.trim() || undefined });
    const existingCompletion = await tx.withdrawalPayoutAttempt.findUnique({ where: { completionIdempotencyKey } });
    if (existingCompletion && existingCompletion.id !== attempt.id) {
      throw new WithdrawalError("WITHDRAWAL_IDEMPOTENCY_CONFLICT", "The operation ID belongs to a different payout completion.");
    }
    if (attempt.completionIdempotencyKey) {
      if (attempt.completionIdempotencyKey !== completionIdempotencyKey || attempt.completionRequestHash !== completionRequestHash) {
        throw new WithdrawalError("WITHDRAWAL_IDEMPOTENCY_CONFLICT", "The operation ID is already associated with different payout evidence.");
      }
      if (withdrawal.status === "PAID") return { kind: "PAID" as const, withdrawal };
    }
    if (withdrawal.status === "PAID") {
      if (attempt.status === "SUCCEEDED" && attempt.externalReference === externalReference) return { kind: "PAID" as const, withdrawal };
      throw new WithdrawalError("WITHDRAWAL_PAYOUT_REFERENCE_CONFLICT", "This withdrawal has already been completed with different payout evidence.");
    }
    const reconciliationRoute = withdrawal.status === "RECONCILIATION_REQUIRED" && (attempt.status === "UNKNOWN" || attempt.status === "PROCESSING");
    if (!(withdrawal.status === "PROCESSING" && attempt.status === "PROCESSING") && !reconciliationRoute) throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "The payout attempt cannot be completed from its current state.");
    assertWithdrawalDualControl({ requestedByUserId: withdrawal.requestedByUserId, approvedByUserId: withdrawal.approvedByUserId, processingUserId: input.actorUserId, requiresDualControl: true });
    if (!withdrawal.reserveLedgerJournalId || withdrawal.releaseLedgerJournalId || withdrawal.payoutLedgerJournalId || withdrawal.payoutDestination.status !== "ACTIVE") throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Withdrawal financial evidence is not coherent for payout completion.");
    const platformWallet = await tx.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } }, select: { id: true, status: true } });
    if (!platformWallet || platformWallet.status !== "ACTIVE") throw new WithdrawalError("WITHDRAWAL_CASH_INSUFFICIENT", "Platform cash clearing is unavailable.");
    const cash = await tx.ledgerAccount.findUnique({ where: { walletId_purpose_currency: { walletId: platformWallet.id, purpose: "CASH_CLEARING", currency: "ZAR" } } });
    if (!cash || cash.category !== "ASSET" || cash.status !== "ACTIVE" || cash.allowNegative) throw new WithdrawalError("WITHDRAWAL_CASH_INSUFFICIENT", "Platform cash clearing is unavailable.");
    const accountIds = [withdrawal.heldAccountId, cash.id].sort();
    const lockedAccounts = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
    if (lockedAccounts.length !== 2) throw new WithdrawalError("WITHDRAWAL_ACCOUNT_INVALID", "Payout accounts were not found.");
    const accounts = await tx.ledgerAccount.findMany({ where: { id: { in: accountIds } } });
    const held = accounts.find((account) => account.id === withdrawal.heldAccountId);
    const cashAfterLock = accounts.find((account) => account.id === cash.id);
    const amount = LedgerMoney.fromDecimal(withdrawal.amount);
    if (!held || held.purpose !== "WITHDRAWAL_HELD" || held.category !== "LIABILITY" || LedgerMoney.fromDecimal(held.currentBalance).lessThan(amount)) throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Held withdrawal liability does not cover this payout.");
    if (!cashAfterLock || LedgerMoney.fromDecimal(cashAfterLock.currentBalance).lessThan(amount)) {
      const now = new Date();
      await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } } });
      await openReconciliationCase(tx, { withdrawalId: withdrawal.id, withdrawalReference: withdrawal.publicReference, attemptId: attempt.id, attemptReference: attempt.publicReference, reason: "INSUFFICIENT_CASH_CLEARING", summary: "Platform cash clearing does not cover the held withdrawal liability." });
      await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, payoutAttemptId: attempt.id, fromStatus: withdrawal.status, toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", reasonCode: "INSUFFICIENT_CASH_CLEARING" } });
      return { kind: "INSUFFICIENT_CASH" as const };
    }
    const conflictingReference = await tx.withdrawalPayoutAttempt.findUnique({ where: { externalReference } });
    if (conflictingReference && conflictingReference.id !== attempt.id) {
      const now = new Date();
      await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } } });
      await openReconciliationCase(tx, { withdrawalId: withdrawal.id, withdrawalReference: withdrawal.publicReference, attemptId: attempt.id, attemptReference: attempt.publicReference, reason: "CONFLICTING_EXTERNAL_REFERENCE", summary: "The external payout reference is already associated with another payout attempt." });
      await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, payoutAttemptId: attempt.id, fromStatus: withdrawal.status, toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", reasonCode: "CONFLICTING_EXTERNAL_REFERENCE" } });
      return { kind: "EXTERNAL_CONFLICT" as const };
    }
    const journal = await postLedgerJournalWithinTransaction(tx, withdrawalPayoutPosting({ withdrawalReference: withdrawal.publicReference, amount: amount.toString(), sourceAccountId: withdrawal.sourceAccountId, heldAccountId: withdrawal.heldAccountId, cashClearingAccountId: cash.id, actorUserId: input.actorUserId, payoutAttemptReference: attempt.publicReference, payoutDestinationReference: withdrawal.payoutDestination.publicReference, ownerType: withdrawal.ownerType, policyVersion: withdrawal.policyVersion }));
    const now = new Date();
    await tx.withdrawalPayoutAttempt.update({ where: { id: attempt.id }, data: { status: "SUCCEEDED", completionIdempotencyKey, completionRequestHash, externalReference, safeEvidenceReference: input.safeEvidenceReference?.trim().slice(0, 160), completedByUserId: input.actorUserId, completedAt: now, version: { increment: 1 } } });
    const paid = await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: "PAID", payoutLedgerJournalId: journal.id, completedByUserId: input.actorUserId, completedAt: now, reconciliationRequiredAt: null, version: { increment: 1 } } });
    await tx.withdrawalReconciliationCase.updateMany({ where: { withdrawalId: withdrawal.id, status: { in: ["OPEN", "MONITORING"] } }, data: { status: "RESOLVED", resolvedAt: now, resolutionCode: "CONFIRMED_EXTERNAL_PAYOUT", resolvedByUserId: input.actorUserId } });
    await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, payoutAttemptId: attempt.id, fromStatus: withdrawal.status, toStatus: "PAID", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, reasonCode: "PAYOUT_COMPLETED", safeMetadata: { payoutAttemptReference: attempt.publicReference, externalPayoutReference: externalReference, payoutJournalReference: journal.reference } } });
    return { kind: "PAID" as const, withdrawal: paid };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  if (result.kind === "INSUFFICIENT_CASH") throw new WithdrawalError("WITHDRAWAL_CASH_INSUFFICIENT", "Platform cash clearing cannot cover this withdrawal; reconciliation is required.");
  if (result.kind === "EXTERNAL_CONFLICT") throw new WithdrawalError("WITHDRAWAL_PAYOUT_REFERENCE_CONFLICT", "The payout reference conflicts with another attempt; reconciliation is required.");
  return result.withdrawal;
}
