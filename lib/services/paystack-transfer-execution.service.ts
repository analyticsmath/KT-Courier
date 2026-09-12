import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { assertWithdrawalDualControl } from "@/lib/withdrawals/withdrawal-dual-control";
import { withdrawalPayoutPosting, withdrawalReleasePosting } from "@/lib/withdrawals/withdrawal-ledger-policy";
import { assertPayoutAttemptTransition } from "@/lib/withdrawals/payout-attempt-state-machine";
import { assertWithdrawalTransition } from "@/lib/withdrawals/withdrawal-state-machine";
import { assertWithdrawalProductionActivation } from "@/lib/withdrawals/withdrawal-production-readiness";
import { WithdrawalError } from "@/lib/withdrawals/errors";
import { lockWithdrawalAccounts } from "./withdrawal-account.service";
import {
  cancelWithdrawalEarningAllocations,
  settleWithdrawalEarningAllocations,
  transitionInFlightDisputesOnPayoutFailure,
  transitionInFlightDisputesOnPayoutSuccess,
} from "./withdrawal-earning-allocation.service";
import {
  PaystackClient,
  zarToSubunitCents,
  assertValidPaystackTransferReference,
  type PaystackTransferData,
} from "@/lib/payments/providers/paystack/paystack-client";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";

export function generatePaystackTransferReference(): string {
  const randomSuffix = crypto.randomBytes(12).toString("hex"); // 24 chars
  const ref = `kt_wpa_${randomSuffix}`; // 31 chars, lowercase letters, digits, underscores
  return assertValidPaystackTransferReference(ref);
}

function payoutAttemptReference(): string {
  return `WPA-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}

function reconciliationReference(): string {
  return `WRC-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}

async function lockWithdrawal(tx: Prisma.TransactionClient, publicReference: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "WithdrawalRequest" WHERE "withdrawalNumber" = ${publicReference} FOR UPDATE`
  );
  if (locked.length !== 1) throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", "Withdrawal request was not found.");
  const withdrawal = await tx.withdrawalRequest.findUnique({
    where: { id: locked[0].id },
    include: { payoutDestination: true },
  });
  if (!withdrawal) throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", "Withdrawal request was not found.");
  return withdrawal;
}

async function openReconciliationCase(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    withdrawalId: string;
    withdrawalReference: string;
    attemptId?: string;
    attemptReference?: string;
    reason: "UNKNOWN_PAYOUT_OUTCOME" | "INSUFFICIENT_CASH_CLEARING" | "CONFLICTING_EXTERNAL_REFERENCE";
    summary: string;
    safeEvidence?: Record<string, unknown>;
  }>,
) {
  const caseKey = `withdrawal:${input.withdrawalReference}:${input.reason}:${input.attemptReference ?? "none"}`;
  const existing = await tx.withdrawalReconciliationCase.findUnique({ where: { caseKey } });
  if (existing) {
    return tx.withdrawalReconciliationCase.update({
      where: { id: existing.id },
      data: { observationCount: { increment: 1 }, lastObservedAt: new Date() },
    });
  }
  return tx.withdrawalReconciliationCase.create({
    data: {
      publicReference: reconciliationReference(),
      caseKey,
      withdrawalId: input.withdrawalId,
      payoutAttemptId: input.attemptId,
      reason: input.reason,
      priority: "HIGH",
      safeSummary: input.summary,
    },
  });
}

/**
 * Initiates an automated Paystack Transfer for an approved withdrawal.
 * Creates local payout attempt and unique reference in DB FIRST, then invokes Paystack Transfer API.
 * If network call fails or times out, transitions attempt to UNKNOWN and prevents duplicate initiation.
 */
export async function initiatePaystackTransferPayout(
  input: Readonly<{
    actorUserId: string;
    publicReference: string;
    operationId: string;
    clientOverride?: PaystackClient;
  }>,
) {
  assertWithdrawalProductionActivation();

  const operationId = input.operationId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(operationId)) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", "A valid operation ID is required.");
  }

  // Step 1: Create local payout attempt + unique merchant transfer reference inside short DB transaction
  const step1Result = await withLedgerRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const withdrawal = await lockWithdrawal(tx, input.publicReference);
        if (withdrawal.status !== "APPROVED" || !withdrawal.approvedByUserId) {
          throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Only approved withdrawals can start payout processing.");
        }
        assertWithdrawalDualControl({
          requestedByUserId: withdrawal.requestedByUserId,
          approvedByUserId: withdrawal.approvedByUserId,
          processingUserId: input.actorUserId,
          requiresDualControl: true,
        });

        if (withdrawal.payoutDestination.status !== "ACTIVE") {
          throw new WithdrawalError("WITHDRAWAL_DESTINATION_INACTIVE", "The payout destination is not active.");
        }
        if (withdrawal.payoutDestination.method !== "PAYSTACK_TRANSFER") {
          throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Destination method is not PAYSTACK_TRANSFER.");
        }

        const active = await tx.withdrawalPayoutAttempt.count({
          where: { withdrawalId: withdrawal.id, status: { in: ["RESERVED", "PROCESSING", "UNKNOWN"] } },
        });
        if (active > 0) {
          throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "This withdrawal already has an active payout attempt.");
        }

        const existing = await tx.withdrawalPayoutAttempt.findUnique({ where: { idempotencyKey: operationId } });
        if (existing) {
          return { replay: true as const, attempt: existing, withdrawal };
        }

        const merchantReference = generatePaystackTransferReference();
        const now = new Date();
        const attempt = await tx.withdrawalPayoutAttempt.create({
          data: {
            publicReference: payoutAttemptReference(),
            withdrawalId: withdrawal.id,
            attemptNumber: withdrawal.latestAttemptNumber + 1,
            method: "PAYSTACK_TRANSFER",
            status: "PROCESSING",
            idempotencyKey: operationId,
            requestHash: crypto.createHash("sha256").update(JSON.stringify({ withdrawalId: withdrawal.id, operationId, actorUserId: input.actorUserId })).digest("hex"),
            externalReference: merchantReference, // merchant transfer reference (16-50 chars)
            initiatedByUserId: input.actorUserId,
            startedAt: now,
          },
        });

        await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            status: "PROCESSING",
            latestAttemptNumber: attempt.attemptNumber,
            currentPayoutAttemptId: attempt.id,
            version: { increment: 1 },
          },
        });

        await tx.withdrawalStatusHistory.create({
          data: {
            withdrawalId: withdrawal.id,
            payoutAttemptId: attempt.id,
            fromStatus: "APPROVED",
            toStatus: "PROCESSING",
            actorType: "FINANCE_ADMIN",
            actorUserId: input.actorUserId,
            reasonCode: "PAYSTACK_TRANSFER_INITIATED",
            safeMetadata: {
              payoutAttemptReference: attempt.publicReference,
              merchantTransferReference: merchantReference,
              recipientCode: withdrawal.payoutDestination.externalReference,
            },
          },
        });

        return { replay: false as const, attempt, withdrawal };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  if (step1Result.replay) {
    return step1Result.attempt;
  }

  const { attempt, withdrawal } = step1Result;
  const merchantReference = attempt.externalReference!;
  const amountCents = zarToSubunitCents(withdrawal.amount.toString());
  const recipientCode = withdrawal.payoutDestination.externalReference;

  // Step 2: Call Paystack Transfer API OUTSIDE DB transaction (no lock held!)
  const secretKey = resolvePaystackConfiguration().runtime?.secretKey ?? process.env.PAYSTACK_SECRET_KEY?.trim();
  const client = input.clientOverride ?? (secretKey ? new PaystackClient({ secretKey }) : null);

  if (!client) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Paystack client is not configured for transfers.");
  }

  let transferResult: PaystackTransferData | null = null;
  let callFailed = false;
  let failureMessage = "";

  try {
    transferResult = await client.initiateTransfer({
      source: "balance",
      amountCents,
      recipient: recipientCode,
      reference: merchantReference,
      reason: `KT Couriers Withdrawal ${withdrawal.publicReference}`,
    });
  } catch (error) {
    callFailed = true;
    failureMessage = error instanceof Error ? error.message : String(error);
  }

  // Step 3: Handle outcome in short DB transaction
  return prisma.$transaction(async (tx) => {
    const freshAttempt = await tx.withdrawalPayoutAttempt.findUnique({ where: { id: attempt.id } });
    if (!freshAttempt) throw new WithdrawalError("WITHDRAWAL_PAYOUT_NOT_FOUND", "Payout attempt could not be reloaded.");

    const now = new Date();

    if (callFailed || !transferResult) {
      // Ambiguous failure / network timeout -> Mark UNKNOWN! Do NOT initiate a second transfer!
      assertPayoutAttemptTransition(freshAttempt.status, "UNKNOWN");
      assertWithdrawalTransition("PROCESSING", "RECONCILIATION_REQUIRED");

      await tx.withdrawalPayoutAttempt.update({
        where: { id: freshAttempt.id },
        data: {
          status: "UNKNOWN",
          failureCategory: "OTHER_SAFE_FAILURE",
          failureCode: "TRANSFER_INITIATE_TIMEOUT",
          failureMessage: failureMessage.slice(0, 240),
          unknownAt: now,
          lastPolledAt: now,
          version: { increment: 1 },
        },
      });

      await tx.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: "RECONCILIATION_REQUIRED",
          reconciliationRequiredAt: now,
          version: { increment: 1 },
        },
      });

      await openReconciliationCase(tx, {
        withdrawalId: withdrawal.id,
        withdrawalReference: withdrawal.publicReference,
        attemptId: freshAttempt.id,
        attemptReference: freshAttempt.publicReference,
        reason: "UNKNOWN_PAYOUT_OUTCOME",
        summary: `Paystack transfer initiation outcome unknown: ${failureMessage.slice(0, 100)}`,
        safeEvidence: { merchantReference },
      });

      return tx.withdrawalPayoutAttempt.findUnique({ where: { id: freshAttempt.id } });
    }

    // Transfer initiation succeeded. Update transferCode and providerReference
    const transferCode = transferResult.transfer_code;
    const providerIdStr = String(transferResult.id);

    // Paystack status can be: "otp", "pending", "success", "failed", etc.
    if (transferResult.status === "otp") {
      // OTP required by merchant account settings -> Route to authorized review
      await tx.withdrawalPayoutAttempt.update({
        where: { id: freshAttempt.id },
        data: {
          transferCode,
          providerReference: providerIdStr,
          status: "PROCESSING",
          safeEvidenceReference: "PAYSTACK_OTP_REQUIRED",
          version: { increment: 1 },
        },
      });

      await tx.withdrawalStatusHistory.create({
        data: {
          withdrawalId: withdrawal.id,
          payoutAttemptId: freshAttempt.id,
          fromStatus: "PROCESSING",
          toStatus: "PROCESSING",
          actorType: "SYSTEM",
          reasonCode: "TRANSFER_OTP_REQUIRED",
          safeMetadata: { actorType: "PROVIDER", transferCode, merchantReference },
        },
      });

      return tx.withdrawalPayoutAttempt.findUnique({ where: { id: freshAttempt.id } });
    }

    if (transferResult.status === "failed" || transferResult.status === "rejected") {
      assertPayoutAttemptTransition(freshAttempt.status, "FAILED");
      assertWithdrawalTransition("PROCESSING", "APPROVED");

      await tx.withdrawalPayoutAttempt.update({
        where: { id: freshAttempt.id },
        data: {
          transferCode,
          providerReference: providerIdStr,
          status: "FAILED",
          failureCategory: "EXTERNAL_SYSTEM_REJECTED",
          failureCode: `PAYSTACK_${transferResult.status.toUpperCase()}`,
          failureMessage: "Paystack rejected transfer initiation.",
          failedAt: now,
          version: { increment: 1 },
        },
      });

      await tx.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: "APPROVED",
          currentPayoutAttemptId: null,
          version: { increment: 1 },
        },
      });

      return tx.withdrawalPayoutAttempt.findUnique({ where: { id: freshAttempt.id } });
    }

    // Default: transfer accepted by Paystack, waiting for webhook or polling ("pending" or "success")
    return tx.withdrawalPayoutAttempt.update({
      where: { id: freshAttempt.id },
      data: {
        transferCode,
        providerReference: providerIdStr,
        status: "PROCESSING",
        lastPolledAt: now,
        version: { increment: 1 },
      },
    });
  });
}

/**
 * Handles Paystack transfer.success webhook or verified success poll.
 * Strictly verifies expected merchant reference, transfer code, amount, currency, and recipient code.
 * Posts the cash-clearing ledger journal and finalizes withdrawal to PAID.
 */
export async function handlePaystackTransferSuccess(
  input: Readonly<{
    merchantReference: string;
    transferCode?: string;
    amountCents: number;
    currency: string;
    recipientCode?: string;
    sourceAddress?: string;
  }>,
) {
  return withLedgerRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const attempt = await tx.withdrawalPayoutAttempt.findUnique({
          where: { externalReference: input.merchantReference },
          include: { withdrawal: { include: { payoutDestination: true } } },
        });

        if (!attempt) {
          return { outcome: "RECONCILIATION_REQUIRED" as const, reason: "ATTEMPT_NOT_FOUND" };
        }

        const withdrawal = attempt.withdrawal;

        // Verify transfer details match exactly (Amendment 11)
        const expectedCents = zarToSubunitCents(withdrawal.amount.toString());
        const isAmountMatch = input.amountCents === expectedCents;
        const isCurrencyMatch = input.currency === "ZAR";
        const isRecipientMatch = !input.recipientCode || input.recipientCode === withdrawal.payoutDestination.externalReference;
        const isTransferCodeMatch = !input.transferCode || !attempt.transferCode || input.transferCode === attempt.transferCode;

        if (!isAmountMatch || !isCurrencyMatch || !isRecipientMatch || !isTransferCodeMatch) {
          const now = new Date();
          await tx.withdrawalRequest.update({
            where: { id: withdrawal.id },
            data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } },
          });
          await openReconciliationCase(tx, {
            withdrawalId: withdrawal.id,
            withdrawalReference: withdrawal.publicReference,
            attemptId: attempt.id,
            attemptReference: attempt.publicReference,
            reason: "CONFLICTING_EXTERNAL_REFERENCE",
            summary: "Transfer webhook data does not match internal payout attempt records.",
            safeEvidence: {
              receivedCents: input.amountCents,
              expectedCents,
              receivedCurrency: input.currency,
            },
          });
          return { outcome: "RECONCILIATION_REQUIRED" as const, reason: "MISMATCH" };
        }

        // Idempotency: if already paid, return duplicate safely
        if (withdrawal.status === "PAID" && attempt.status === "SUCCEEDED") {
          return { outcome: "DUPLICATE" as const, withdrawalId: withdrawal.id };
        }

        // Lock accounts and post ledger settlement: Debit WITHDRAWAL_HELD, Credit CASH_CLEARING
        const platformWallet = await tx.wallet.findUnique({
          where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } },
        });
        if (!platformWallet) throw new WithdrawalError("WITHDRAWAL_CASH_INSUFFICIENT", "Platform wallet missing.");

        const cash = await tx.ledgerAccount.findUnique({
          where: { walletId_purpose_currency: { walletId: platformWallet.id, purpose: "CASH_CLEARING", currency: "ZAR" } },
        });
        if (!cash) throw new WithdrawalError("WITHDRAWAL_CASH_INSUFFICIENT", "Cash clearing account missing.");

        const now = new Date();
        const journal = await postLedgerJournalWithinTransaction(
          tx,
          withdrawalPayoutPosting({
            withdrawalReference: withdrawal.publicReference,
            amount: withdrawal.amount.toFixed(2),
            sourceAccountId: withdrawal.sourceAccountId,
            heldAccountId: withdrawal.heldAccountId,
            cashClearingAccountId: cash.id,
            actorUserId: attempt.initiatedByUserId,
            payoutAttemptReference: attempt.publicReference,
            payoutDestinationReference: withdrawal.payoutDestination.publicReference,
            ownerType: withdrawal.ownerType,
            policyVersion: withdrawal.policyVersion,
          }),
        );

        await tx.withdrawalPayoutAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "SUCCEEDED",
            transferCode: input.transferCode ?? attempt.transferCode,
            completedAt: now,
            version: { increment: 1 },
          },
        });

        const updatedWithdrawal = await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            status: "PAID",
            payoutLedgerJournalId: journal.id,
            completedAt: now,
            reconciliationRequiredAt: null,
            version: { increment: 1 },
          },
        });

        await settleWithdrawalEarningAllocations(tx, withdrawal.id);
        await transitionInFlightDisputesOnPayoutSuccess(tx, withdrawal.id);

        await tx.withdrawalReconciliationCase.updateMany({
          where: { withdrawalId: withdrawal.id, status: { in: ["OPEN", "MONITORING"] } },
          data: { status: "RESOLVED", resolvedAt: now, resolutionCode: "CONFIRMED_PAYSTACK_TRANSFER" },
        });

        await tx.withdrawalStatusHistory.create({
          data: {
            withdrawalId: withdrawal.id,
            payoutAttemptId: attempt.id,
            fromStatus: withdrawal.status,
            toStatus: "PAID",
            actorType: "SYSTEM",
            reasonCode: "PAYSTACK_TRANSFER_SUCCESS",
            safeMetadata: {
              actorType: "PROVIDER",
              merchantReference: input.merchantReference,
              transferCode: input.transferCode,
              journalReference: journal.reference,
            },
          },
        });

        return { outcome: "APPLIED" as const, withdrawal: updatedWithdrawal };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

/**
 * Handles Paystack transfer.failed webhook.
 * Transitions attempt to FAILED, restores withdrawal to APPROVED so it can be retried safely.
 * Does NOT release held liability back to wallet prematurely without review.
 */
export async function handlePaystackTransferFailed(
  input: Readonly<{
    merchantReference: string;
    transferCode?: string;
    failureMessage?: string;
  }>,
) {
  return withLedgerRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const attempt = await tx.withdrawalPayoutAttempt.findUnique({
          where: { externalReference: input.merchantReference },
          include: { withdrawal: { include: { payoutDestination: true } } },
        });
        if (!attempt) return { outcome: "IGNORED" as const, reason: "ATTEMPT_NOT_FOUND" };

        const withdrawal = attempt.withdrawal;
        if (withdrawal.status === "PAID") {
          // Internal says paid but provider says failed! Serious discrepancy!
          const now = new Date();
          await tx.withdrawalRequest.update({
            where: { id: withdrawal.id },
            data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } },
          });
          await openReconciliationCase(tx, {
            withdrawalId: withdrawal.id,
            withdrawalReference: withdrawal.publicReference,
            attemptId: attempt.id,
            attemptReference: attempt.publicReference,
            reason: "UNKNOWN_PAYOUT_OUTCOME",
            summary: "Paystack reported transfer failure after payout was already marked PAID locally.",
          });
          return { outcome: "RECONCILIATION_REQUIRED" as const, reason: "PAID_CONFUSED_WITH_FAILED" };
        }

        if (attempt.status === "FAILED") {
          return { outcome: "DUPLICATE" as const, withdrawalId: withdrawal.id };
        }

        assertPayoutAttemptTransition(attempt.status, "FAILED");

        const unresolvedInFlightAllocations = tx.paymentDisputeAllocation
          ? await tx.paymentDisputeAllocation.findMany({
              where: {
                holdingState: "IN_FLIGHT_HOLD",
                settledAt: null,
                withdrawalEarningAllocation: {
                  withdrawalRequestId: withdrawal.id,
                },
                dispute: {
                  status: { in: ["OPEN", "UNDER_REVIEW", "LOST"] },
                },
              },
              include: { dispute: true },
            })
          : [];

        const now = new Date();
        await tx.withdrawalPayoutAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "FAILED",
            failureCategory: "EXTERNAL_SYSTEM_REJECTED",
            failureCode: "PAYSTACK_TRANSFER_FAILED",
            failureMessage: (input.failureMessage ?? "Paystack reported transfer failure").slice(0, 240),
            failedAt: now,
            version: { increment: 1 },
          },
        });

        if (unresolvedInFlightAllocations.length > 0) {
          assertWithdrawalTransition(withdrawal.status, "APPROVED");
          await tx.withdrawalRequest.update({
            where: { id: withdrawal.id },
            data: { status: "APPROVED", version: { increment: 1 } },
          });
          await tx.withdrawalStatusHistory.create({
            data: {
              withdrawalId: withdrawal.id,
              payoutAttemptId: attempt.id,
              fromStatus: withdrawal.status,
              toStatus: "APPROVED",
              actorType: "SYSTEM",
              reasonCode: "PAYSTACK_TRANSFER_FAILED",
              safeMetadata: { actorType: "PROVIDER", merchantReference: input.merchantReference, failureMessage: input.failureMessage },
            },
          });

          await lockWithdrawalAccounts(tx, withdrawal);
          const release = await postLedgerJournalWithinTransaction(
            tx,
            withdrawalReleasePosting({
              withdrawalReference: withdrawal.publicReference,
              amount: withdrawal.amount.toFixed(2),
              sourceAccountId: withdrawal.sourceAccountId,
              heldAccountId: withdrawal.heldAccountId,
              actorUserId: attempt.initiatedByUserId,
              payoutDestinationReference: withdrawal.payoutDestination.publicReference,
              ownerType: withdrawal.ownerType,
              policyVersion: withdrawal.policyVersion,
            }),
          );

          assertWithdrawalTransition("APPROVED", "CANCELLED");
          await tx.withdrawalRequest.update({
            where: { id: withdrawal.id },
            data: {
              status: "CANCELLED",
              currentPayoutAttemptId: null,
              releaseLedgerJournalId: release.id,
              cancelledAt: now,
              cancellationReasonCode: "PAYOUT_FAILED_WITH_DISPUTE",
              version: { increment: 1 },
            },
          });

          await tx.withdrawalStatusHistory.createMany({
            data: [
              {
                withdrawalId: withdrawal.id,
                payoutAttemptId: attempt.id,
                fromStatus: "APPROVED",
                toStatus: "CANCELLED",
                actorType: "SYSTEM",
                reasonCode: "PAYOUT_FAILED_WITH_DISPUTE",
              },
              {
                withdrawalId: withdrawal.id,
                toStatus: "CANCELLED",
                actorType: "SYSTEM",
                reasonCode: "RESERVATION_RELEASED",
                safeMetadata: { releaseJournalReference: release.reference },
              },
            ],
          });

          await cancelWithdrawalEarningAllocations(tx, withdrawal.id);
          await transitionInFlightDisputesOnPayoutFailure(tx, withdrawal.id);
          return { outcome: "APPLIED" as const };
        }

        // Return withdrawal to retryable APPROVED state, keeping held funds reserved
        assertWithdrawalTransition(withdrawal.status, "APPROVED");
        await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            status: "APPROVED",
            currentPayoutAttemptId: null,
            version: { increment: 1 },
          },
        });

        await tx.withdrawalStatusHistory.create({
          data: {
            withdrawalId: withdrawal.id,
            payoutAttemptId: attempt.id,
            fromStatus: withdrawal.status,
            toStatus: "APPROVED",
            actorType: "SYSTEM",
            reasonCode: "PAYSTACK_TRANSFER_FAILED_RETRIED",
            safeMetadata: { actorType: "PROVIDER", merchantReference: input.merchantReference, failureMessage: input.failureMessage },
          },
        });

        await transitionInFlightDisputesOnPayoutFailure(tx, withdrawal.id);

        return { outcome: "APPLIED" as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

/**
 * Handles Paystack transfer.reversed webhook (Amendment 12).
 * Explicit reversal journal restoring provider cash clearing, restoring participant liability to HELD / reconciliation.
 * Does NOT immediately make reversed payout funds withdrawable again!
 */
export async function handlePaystackTransferReversed(
  input: Readonly<{
    merchantReference: string;
    transferCode?: string;
    reason?: string;
  }>,
) {
  return withLedgerRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const attempt = await tx.withdrawalPayoutAttempt.findUnique({
          where: { externalReference: input.merchantReference },
          include: { withdrawal: { include: { payoutDestination: true } } },
        });
        if (!attempt) return { outcome: "IGNORED" as const, reason: "ATTEMPT_NOT_FOUND" };

        const withdrawal = attempt.withdrawal;
        const now = new Date();

        // If previously marked PAID, post explicit reversal journal
        let reversalJournalId: string | null = null;
        if (withdrawal.payoutLedgerJournalId) {
          const platformWallet = await tx.wallet.findUnique({
            where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } },
          });
          const cash = platformWallet
            ? await tx.ledgerAccount.findUnique({
                where: { walletId_purpose_currency: { walletId: platformWallet.id, purpose: "CASH_CLEARING", currency: "ZAR" } },
              })
            : null;

          if (cash) {
            // Reversal posting: Debit CASH_CLEARING, Credit WITHDRAWAL_HELD
            const revJournal = await postLedgerJournalWithinTransaction(tx, {
              idempotencyKey: `rev-payout:${attempt.publicReference}:${now.getTime()}`,
              type: "REVERSAL",
              currency: "ZAR",
              sourceReference: `withdrawal:${withdrawal.publicReference}:reversal`,
              correlationId: attempt.publicReference,
              memo: `Reversal of Paystack transfer payout ${withdrawal.publicReference}`,
              actor: { kind: "SYSTEM" },
              metadata: { merchantReference: input.merchantReference, reason: input.reason },
              entries: [
                { accountId: cash.id, direction: "DEBIT", amount: withdrawal.amount.toFixed(2), lineCode: "CASH_CLEARING_RESTORED" },
                { accountId: withdrawal.heldAccountId, direction: "CREDIT", amount: withdrawal.amount.toFixed(2), lineCode: "WITHDRAWAL_LIABILITY_RESTORED" },
              ],
            });
            reversalJournalId = revJournal.id;
          }
        }

        // Put withdrawal into RECONCILIATION_REQUIRED, held funds intact, awaiting finance decision
        await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            status: "RECONCILIATION_REQUIRED",
            reconciliationRequiredAt: now,
            version: { increment: 1 },
          },
        });

        await tx.withdrawalPayoutAttempt.update({
          where: { id: attempt.id },
          data: {
            safeEvidenceReference: `REVERSED:${reversalJournalId ?? "NO_JOURNAL"}`,
            version: { increment: 1 },
          },
        });

        await openReconciliationCase(tx, {
          withdrawalId: withdrawal.id,
          withdrawalReference: withdrawal.publicReference,
          attemptId: attempt.id,
          attemptReference: attempt.publicReference,
          reason: "UNKNOWN_PAYOUT_OUTCOME",
          summary: `Paystack reported transfer reversed: ${input.reason ?? "Provider reversal"}. Held funds restored.`,
          safeEvidence: { merchantReference: input.merchantReference, reversalJournalId },
        });

        await tx.withdrawalStatusHistory.create({
          data: {
            withdrawalId: withdrawal.id,
            payoutAttemptId: attempt.id,
            fromStatus: withdrawal.status,
            toStatus: "RECONCILIATION_REQUIRED",
            actorType: "SYSTEM",
            reasonCode: "PAYSTACK_TRANSFER_REVERSED",
            safeMetadata: { actorType: "PROVIDER", merchantReference: input.merchantReference, reversalJournalId },
          },
        });

        return { outcome: "APPLIED" as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

/**
 * Handles Paystack transfer blocked or abandoned outcome (Blocker 4).
 * After a bounded grace period or definitive provider response, transitions to finance/reconciliation-required,
 * preserves held funds, and raises an actionable reconciliation case.
 */
export async function handlePaystackTransferBlockedOrAbandoned(
  input: Readonly<{
    merchantReference: string;
    transferCode?: string;
    status: "blocked" | "abandoned" | string;
    reason?: string;
  }>,
) {
  return withLedgerRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const attempt = await tx.withdrawalPayoutAttempt.findUnique({
          where: { externalReference: input.merchantReference },
          include: { withdrawal: true },
        });
        if (!attempt) return { outcome: "IGNORED" as const, reason: "ATTEMPT_NOT_FOUND" };

        const withdrawal = attempt.withdrawal;
        if (withdrawal.status === "PAID") {
          return { outcome: "IGNORED" as const, reason: "ALREADY_PAID" };
        }

        const now = new Date();
        const normStatus = input.status.toLowerCase();
        const codeSuffix = normStatus === "blocked" ? "BLOCKED" : "ABANDONED";

        await tx.withdrawalPayoutAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "UNKNOWN",
            failureCode: `PAYSTACK_TRANSFER_${codeSuffix}`,
            failureMessage: (input.reason ?? `Paystack reported transfer ${normStatus}`).slice(0, 240),
            unknownAt: now,
            version: { increment: 1 },
          },
        });

        await tx.withdrawalRequest.update({
          where: { id: withdrawal.id },
          data: {
            status: "RECONCILIATION_REQUIRED",
            reconciliationRequiredAt: now,
            version: { increment: 1 },
          },
        });

        await openReconciliationCase(tx, {
          withdrawalId: withdrawal.id,
          withdrawalReference: withdrawal.publicReference,
          attemptId: attempt.id,
          attemptReference: attempt.publicReference,
          reason: "UNKNOWN_PAYOUT_OUTCOME",
          summary: `Paystack reported transfer ${normStatus}: ${input.reason ?? "Blocked or abandoned by provider"}. Held funds preserved.`,
          safeEvidence: { merchantReference: input.merchantReference, transferStatus: normStatus },
        });

        await tx.withdrawalStatusHistory.create({
          data: {
            withdrawalId: withdrawal.id,
            payoutAttemptId: attempt.id,
            fromStatus: withdrawal.status,
            toStatus: "RECONCILIATION_REQUIRED",
            actorType: "SYSTEM",
            reasonCode: `PAYSTACK_TRANSFER_${codeSuffix}`,
            safeMetadata: { actorType: "PROVIDER", merchantReference: input.merchantReference, status: normStatus },
          },
        });

        return { outcome: "APPLIED" as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

/**
 * Finalizes a Paystack transfer requiring OTP (Blocker 4).
 * Authorized finance-only action.
 * OTP is ephemeral and NEVER stored in the database or logged.
 * Rate limited to maximum 3 attempts per payout attempt.
 * Ambiguous / timeout provider response transitions attempt to UNKNOWN / reconciliation.
 * Webhook/reconciliation remains authoritative for terminal settlement.
 */
export async function finalizePaystackTransferOtp(
  input: Readonly<{
    actorUserId: string;
    merchantReference: string;
    otp: string;
    clientOverride?: PaystackClient;
  }>,
): Promise<{ outcome: "SUCCESS" | "UNKNOWN" | "FAILED"; message: string }> {
  assertWithdrawalProductionActivation();

  const otp = input.otp.trim();
  if (!/^\d{4,10}$/.test(otp)) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", "A valid OTP is required.");
  }

  // Verify actor exists and is active
  const actor = await prisma.user.findUnique({ where: { id: input.actorUserId } });
  if (!actor || actor.status !== "ACTIVE") {
    throw new WithdrawalError("WITHDRAWAL_FORBIDDEN", "Active finance user is required for OTP finalization.");
  }

  // Resolve Paystack client
  const secretKey = resolvePaystackConfiguration().runtime?.secretKey ?? process.env.PAYSTACK_SECRET_KEY?.trim();
  const client = input.clientOverride ?? (secretKey ? new PaystackClient({ secretKey }) : null);
  if (!client) {
    throw new WithdrawalError("WITHDRAWAL_CASH_INSUFFICIENT", "Paystack client is not configured.");
  }

  // Load attempt and verify eligibility
  const attempt = await prisma.withdrawalPayoutAttempt.findUnique({
    where: { externalReference: input.merchantReference },
    include: { withdrawal: true },
  });
  if (!attempt) {
    throw new WithdrawalError("WITHDRAWAL_PAYOUT_NOT_FOUND", "Payout attempt not found for merchant reference.");
  }

  if (attempt.withdrawal.status === "PAID") {
    return { outcome: "SUCCESS", message: "Transfer is already paid." };
  }

  if (attempt.status !== "PROCESSING" && attempt.status !== "UNKNOWN") {
    throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", `Cannot finalize OTP for attempt in ${attempt.status} status.`);
  }

  // Rate limiting check: max 3 attempts
  const priorAttemptsCount = await prisma.withdrawalStatusHistory.count({
    where: {
      payoutAttemptId: attempt.id,
      reasonCode: "OTP_FINALIZATION_ATTEMPTED",
    },
  });

  if (priorAttemptsCount >= 3) {
    // Exceeded rate limit: transition to UNKNOWN / reconciliation
    await withLedgerRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const now = new Date();
          await tx.withdrawalPayoutAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "UNKNOWN",
              failureCode: "OTP_RATE_LIMITED",
              failureMessage: "Maximum OTP attempts exceeded (3 max).",
              unknownAt: now,
              version: { increment: 1 },
            },
          });
          await tx.withdrawalRequest.update({
            where: { id: attempt.withdrawal.id },
            data: {
              status: "RECONCILIATION_REQUIRED",
              reconciliationRequiredAt: now,
              version: { increment: 1 },
            },
          });
          await openReconciliationCase(tx, {
            withdrawalId: attempt.withdrawal.id,
            withdrawalReference: attempt.withdrawal.publicReference,
            attemptId: attempt.id,
            attemptReference: attempt.publicReference,
            reason: "UNKNOWN_PAYOUT_OUTCOME",
            summary: "Maximum OTP finalization attempts exceeded (3). Requires finance reconciliation.",
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    throw new WithdrawalError("WITHDRAWAL_POLICY_LIMIT", "Maximum OTP finalization attempts exceeded (3 max).");
  }

  // Audit that an OTP attempt occurred (NEVER storing or logging the OTP itself)
  await prisma.withdrawalStatusHistory.create({
    data: {
      withdrawalId: attempt.withdrawal.id,
      payoutAttemptId: attempt.id,
      fromStatus: attempt.withdrawal.status,
      toStatus: attempt.withdrawal.status,
      actorType: "FINANCE_ADMIN",
      actorUserId: input.actorUserId,
      reasonCode: "OTP_FINALIZATION_ATTEMPTED",
      safeMetadata: { actorType: "FINANCE_ADMIN", attemptNumber: priorAttemptsCount + 1 },
    },
  });

  const transferCode = attempt.transferCode;
  if (!transferCode) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_STATE", "Payout attempt does not have an external transfer code.");
  }

  try {
    const transferData = await client.finalizeTransfer({
      transfer_code: transferCode,
      otp,
    });

    const status = (transferData.status || "").toLowerCase();
    if (status === "success") {
      return { outcome: "SUCCESS", message: "Transfer OTP verified successfully by Paystack." };
    }

    return { outcome: "SUCCESS", message: `Transfer OTP submitted. Current status: ${status}.` };
  } catch (err: unknown) {
    const isTimeoutOrNetwork =
      err instanceof Error &&
      (err.name === "AbortError" ||
        err.message.includes("timeout") ||
        err.message.includes("ECONNRESET") ||
        err.message.includes("ETIMEDOUT") ||
        err.message.includes("fetch failed"));

    if (isTimeoutOrNetwork) {
      await withLedgerRetry(() =>
        prisma.$transaction(
          async (tx) => {
            const now = new Date();
            await tx.withdrawalPayoutAttempt.update({
              where: { id: attempt.id },
              data: {
                status: "UNKNOWN",
                failureCode: "OTP_FINALIZATION_TIMEOUT",
                failureMessage: "Paystack OTP finalization timed out or ambiguous.",
                unknownAt: now,
                version: { increment: 1 },
              },
            });
            await tx.withdrawalRequest.update({
              where: { id: attempt.withdrawal.id },
              data: {
                status: "RECONCILIATION_REQUIRED",
                reconciliationRequiredAt: now,
                version: { increment: 1 },
              },
            });
            await openReconciliationCase(tx, {
              withdrawalId: attempt.withdrawal.id,
              withdrawalReference: attempt.withdrawal.publicReference,
              attemptId: attempt.id,
              attemptReference: attempt.publicReference,
              reason: "UNKNOWN_PAYOUT_OUTCOME",
              summary: "Paystack OTP finalization timed out or had network failure. Transitioned to UNKNOWN.",
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
      return { outcome: "UNKNOWN", message: "Paystack OTP finalization timed out or ambiguous. Reconciled as UNKNOWN." };
    }

    const failureMsg = err instanceof Error ? err.message : "Paystack OTP finalization failed";
    return { outcome: "FAILED", message: failureMsg };
  }
}
