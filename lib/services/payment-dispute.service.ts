import { randomBytes } from "node:crypto";
import {
  Prisma,
  PaymentDisputeReason,
  PaymentDisputeStatus,
  PaymentDisputeHoldingState,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { lockWithdrawalAccounts } from "@/lib/services/withdrawal-account.service";
import { withdrawalReleasePosting } from "@/lib/withdrawals/withdrawal-ledger-policy";
import {
  getEarningProvenanceSummary,
  partitionDisputedShareByProvenance,
  cancelWithdrawalEarningAllocations,
} from "@/lib/services/withdrawal-earning-allocation.service";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { PaymentError } from "@/lib/payments/errors";

export { PaymentDisputeReason, PaymentDisputeStatus, PaymentDisputeHoldingState };

export interface OpenPaymentDisputeInput {
  paymentId?: string;
  paymentPublicReference?: string;
  providerDisputeId?: string;
  amount: string | number | Prisma.Decimal;
  currency?: "ZAR";
  reason?: PaymentDisputeReason;
  providerStatus?: string;
  evidenceDueBy?: Date | string | null;
  safeEvidence?: Record<string, unknown> | null;
  actorType?: "PROVIDER" | "SYSTEM" | "USER";
  actorUserId?: string | null;
}

export interface ResolvePaymentDisputeInput {
  disputeId?: string;
  disputePublicReference?: string;
  providerDisputeId?: string;
  resolution: "WON" | "LOST";
  providerStatus?: string;
  actorType?: "PROVIDER" | "SYSTEM" | "USER";
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdatePaymentDisputeEvidenceInput {
  disputeId?: string;
  disputePublicReference?: string;
  providerDisputeId?: string;
  evidenceDueBy?: Date | string | null;
  safeEvidence?: Record<string, unknown> | null;
  providerStatus?: string;
  actorType?: "PROVIDER" | "SYSTEM" | "USER";
  actorUserId?: string | null;
}

// ─── Evidence Allowlist Schema (Blocker 2) ───────────────────────────────────

export const DisputeSafeEvidenceAllowlistSchema = z.object({
  schemaVersion: z.literal("1.0.0").default("1.0.0"),
  providerDisputeId: z.string().min(1),
  transactionReference: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("ZAR"),
  status: z.string().default("open"),
  reason: z.string().default("other"),
  evidenceDueBy: z.string().nullable().optional(),
  authorizedPrivateObjectReferences: z.array(z.string()).default([]),
  explanation: z.string().max(2000).optional(),
  extractedAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type DisputeSafeEvidence = z.infer<typeof DisputeSafeEvidenceAllowlistSchema>;

/**
 * Explicit, versioned allowlist schema extractor.
 * Discards all arbitrary provider payloads, unapproved fields, and customer PII.
 */
export function sanitizeEvidenceSnapshot(
  rawInput?: Record<string, unknown> | null,
): DisputeSafeEvidence | null {
  if (!rawInput || typeof rawInput !== "object") return null;

  const directParse = DisputeSafeEvidenceAllowlistSchema.safeParse(rawInput);
  if (directParse.success) {
    return directParse.data;
  }

  const providerDisputeId = typeof rawInput.providerDisputeId === "string"
    ? rawInput.providerDisputeId
    : (rawInput.id !== undefined && rawInput.id !== null ? String(rawInput.id) : undefined);

  const transactionReference = typeof rawInput.transactionReference === "string"
    ? rawInput.transactionReference
    : (typeof rawInput.reference === "string"
      ? rawInput.reference
      : (typeof rawInput.transaction_reference === "string" ? rawInput.transaction_reference : undefined));

  const amount = typeof rawInput.amount === "number"
    ? rawInput.amount
    : (typeof rawInput.amount === "string" ? Number(rawInput.amount) : undefined);

  const currency = typeof rawInput.currency === "string" ? rawInput.currency.toUpperCase() : "ZAR";
  const status = typeof rawInput.status === "string" ? rawInput.status : "open";
  const reason = typeof rawInput.reason === "string" ? rawInput.reason : "other";
  const evidenceDueBy = typeof rawInput.evidenceDueBy === "string"
    ? rawInput.evidenceDueBy
    : (typeof rawInput.due_at === "string"
      ? rawInput.due_at
      : (typeof rawInput.evidence_deadline === "string" ? rawInput.evidence_deadline : null));

  const authorizedRefs = Array.isArray(rawInput.authorizedPrivateObjectReferences)
    ? rawInput.authorizedPrivateObjectReferences.filter((r): r is string => typeof r === "string")
    : [];

  const explanation = typeof rawInput.explanation === "string" ? rawInput.explanation.slice(0, 2000) : undefined;

  if (!providerDisputeId || !transactionReference || amount === undefined || isNaN(amount) || amount <= 0) {
    return null;
  }

  return {
    schemaVersion: "1.0.0",
    providerDisputeId,
    transactionReference,
    amount,
    currency,
    status,
    reason,
    evidenceDueBy,
    authorizedPrivateObjectReferences: authorizedRefs,
    ...(explanation ? { explanation } : {}),
    extractedAt: new Date().toISOString(),
  };
}

function generateDisputePublicReference(): string {
  return `pds_${randomBytes(12).toString("hex")}`;
}

function generateAllocationPublicReference(): string {
  return `pda_${randomBytes(12).toString("hex")}`;
}

function safeAccountCode(str: string): string {
  return str.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);
}

// ─── Deterministic Ledger Account Resolvers ───────────────────────────────────

async function resolveOwnerWithdrawableAccount(
  tx: Prisma.TransactionClient,
  walletId: string,
) {
  const existing = await tx.ledgerAccount.findFirst({
    where: {
      walletId,
      purpose: "OWNER_WITHDRAWABLE",
      currency: "ZAR",
      status: "ACTIVE",
    },
  });
  if (existing) return existing;

  const code = `OWN-WD-${safeAccountCode(walletId)}`.toUpperCase();
  return tx.ledgerAccount.create({
    data: {
      walletId,
      code,
      purpose: "OWNER_WITHDRAWABLE",
      category: "LIABILITY",
      currency: "ZAR",
      status: "ACTIVE",
    },
  });
}

async function resolveOwnerDisputeHeldAccount(
  tx: Prisma.TransactionClient,
  walletId: string,
  ownerType: "STORE" | "DRIVER",
  ownerId: string,
) {
  const existing = await tx.ledgerAccount.findFirst({
    where: {
      walletId,
      purpose: "HELD",
      currency: "ZAR",
      status: "ACTIVE",
    },
  });
  if (existing) return existing;

  const code = `${ownerType}-DISPUTE-HELD-${safeAccountCode(ownerId)}-ZAR`;
  return tx.ledgerAccount.create({
    data: {
      walletId,
      code,
      purpose: "HELD",
      category: "LIABILITY",
      currency: "ZAR",
      status: "ACTIVE",
    },
  });
}

async function resolveOwnerReceivableAccount(
  tx: Prisma.TransactionClient,
  walletId: string,
  ownerType: "STORE" | "DRIVER",
  ownerId: string,
) {
  const existing = await tx.ledgerAccount.findFirst({
    where: {
      walletId,
      purpose: "ADJUSTMENT",
      category: "ASSET",
      currency: "ZAR",
      status: "ACTIVE",
    },
  });
  if (existing) return existing;

  const code = `${ownerType}-RECEIVABLE-${safeAccountCode(ownerId)}-ZAR`;
  return tx.ledgerAccount.create({
    data: {
      walletId,
      code,
      purpose: "ADJUSTMENT",
      category: "ASSET",
      currency: "ZAR",
      allowNegative: true,
      status: "ACTIVE",
    },
  });
}

// ─── Dispute Exposure Calculation ─────────────────────────────────────────────

interface RawParticipantAllocation {
  participantType: "STORE" | "DRIVER" | "PLATFORM";
  participantId: string;
  storeEarningId?: string;
  driverEarningId?: string;
  originalAmountCents: number;
}

interface CalculatedAllocation {
  participantType: "STORE" | "DRIVER" | "PLATFORM";
  participantId: string;
  storeEarningId?: string;
  driverEarningId?: string;
  allocatedAmountCents: number;
}

/**
 * Deterministically distributes the disputed amount across original payment allocations.
 * Invariant: sum(allocations) == disputeAmount exactly.
 */
function calculateDisputeAllocations(
  rawAllocations: RawParticipantAllocation[],
  paymentAmountCents: number,
  disputeAmountCents: number,
): CalculatedAllocation[] {
  if (rawAllocations.length === 0) {
    return [{
      participantType: "PLATFORM",
      participantId: "platform",
      allocatedAmountCents: disputeAmountCents,
    }];
  }

  if (disputeAmountCents >= paymentAmountCents) {
    return rawAllocations.map((raw) => ({
      participantType: raw.participantType,
      participantId: raw.participantId,
      storeEarningId: raw.storeEarningId,
      driverEarningId: raw.driverEarningId,
      allocatedAmountCents: raw.originalAmountCents,
    }));
  }

  // Pro-rate partial dispute deterministically
  const ratio = disputeAmountCents / paymentAmountCents;
  let allocatedSum = 0;
  const result: CalculatedAllocation[] = [];

  for (let i = 0; i < rawAllocations.length; i++) {
    const raw = rawAllocations[i];
    const isLast = i === rawAllocations.length - 1;
    let shareCents = Math.floor(raw.originalAmountCents * ratio);
    if (isLast) {
      shareCents = disputeAmountCents - allocatedSum;
    }
    allocatedSum += shareCents;
    result.push({
      participantType: raw.participantType,
      participantId: raw.participantId,
      storeEarningId: raw.storeEarningId,
      driverEarningId: raw.driverEarningId,
      allocatedAmountCents: shareCents,
    });
  }

  return result;
}

function consolidateJournalEntries(
  entries: Array<{ accountId: string; direction: "DEBIT" | "CREDIT"; amount: string; lineCode: string }>
): Array<{ accountId: string; direction: "DEBIT" | "CREDIT"; amount: string; lineCode: string }> {
  const map = new Map<string, { accountId: string; direction: "DEBIT" | "CREDIT"; amount: Prisma.Decimal; lineCode: string }>();
  for (const entry of entries) {
    const key = `${entry.accountId}:${entry.direction}`;
    const existing = map.get(key);
    if (existing) {
      existing.amount = existing.amount.add(new Prisma.Decimal(entry.amount));
    } else {
      map.set(key, {
        accountId: entry.accountId,
        direction: entry.direction,
        amount: new Prisma.Decimal(entry.amount),
        lineCode: entry.lineCode,
      });
    }
  }
  return Array.from(map.values()).map((e) => ({
    accountId: e.accountId,
    direction: e.direction,
    amount: e.amount.toFixed(2),
    lineCode: e.lineCode,
  }));
}

// ─── Open Payment Dispute ─────────────────────────────────────────────────────

export async function openPaymentDispute(input: OpenPaymentDisputeInput) {
  const amountDecimal = new Prisma.Decimal(input.amount);
  if (amountDecimal.isNegative() || amountDecimal.isZero() || !amountDecimal.isFinite()) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", "Dispute amount must be a positive number.");
  }

  const sanitizedEvidence = sanitizeEvidenceSnapshot(input.safeEvidence);
  const evidenceDue = input.evidenceDueBy ? new Date(input.evidenceDueBy) : null;

  return withLedgerRetry(() =>
    prisma.$transaction(async (tx) => {
    // 1. Idempotency check on providerDisputeId
    if (input.providerDisputeId) {
      const existing = await tx.paymentDispute.findUnique({
        where: { providerDisputeId: input.providerDisputeId },
        include: { history: true, allocations: true },
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Find target Payment and original earnings
    let payment = null;
    if (input.paymentId) {
      payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    } else if (input.paymentPublicReference) {
      payment = await tx.payment.findUnique({ where: { publicReference: input.paymentPublicReference } });
    }

    if (!payment) {
      throw new PaymentError("PAYMENT_NOT_FOUND", "Payment associated with dispute could not be found.");
    }

    const [storeEarnings, driverEarnings] = await Promise.all([
      tx.storeEarning.findMany({ where: { paymentId: payment.id }, orderBy: { id: "asc" } }),
      tx.driverEarning.findMany({ where: { paymentId: payment.id }, orderBy: { id: "asc" } }),
    ]);

    // Strict domain check on StoreEarning / DriverEarning status
    for (const se of storeEarnings) {
      if (se.status === "FULLY_REFUNDED" || se.status === "REVERSED") {
        throw new PaymentError("PAYMENT_INVALID_STATE", `Cannot dispute payment with store earning in ${se.status} state.`);
      }
      if (se.status === "RECONCILIATION_REQUIRED") {
        throw new PaymentError("PAYMENT_INVALID_STATE", "Cannot dispute payment with store earning in RECONCILIATION_REQUIRED state.");
      }
      if (se.status !== "ACCRUED" && se.status !== "RELEASED") {
        throw new PaymentError("PAYMENT_INVALID_STATE", `Store earning status ${se.status} is not eligible for dispute.`);
      }
    }

    for (const de of driverEarnings) {
      if (de.status === "FULLY_REFUNDED" || de.status === "REVERSED") {
        throw new PaymentError("PAYMENT_INVALID_STATE", `Cannot dispute payment with driver earning in ${de.status} state.`);
      }
      if (de.status === "RECONCILIATION_REQUIRED") {
        throw new PaymentError("PAYMENT_INVALID_STATE", "Cannot dispute payment with driver earning in RECONCILIATION_REQUIRED state.");
      }
      if (de.status !== "ACCRUED" && de.status !== "RELEASED") {
        throw new PaymentError("PAYMENT_INVALID_STATE", `Driver earning status ${de.status} is not eligible for dispute.`);
      }
    }

    // Lock Ordering: WithdrawalRequest -> StoreEarning / DriverEarning -> PaymentDispute -> LedgerAccount
    const allStoreEarningIds = storeEarnings.map((s) => s.id);
    const allDriverEarningIds = driverEarnings.map((d) => d.id);

    if (tx.withdrawalEarningAllocation && (allStoreEarningIds.length > 0 || allDriverEarningIds.length > 0)) {
      const linkedAllocations = await tx.withdrawalEarningAllocation.findMany({
        where: {
          OR: [
            ...(allStoreEarningIds.length > 0 ? [{ storeEarningId: { in: allStoreEarningIds } }] : []),
            ...(allDriverEarningIds.length > 0 ? [{ driverEarningId: { in: allDriverEarningIds } }] : []),
          ],
        },
        select: { withdrawalRequestId: true },
      });
      const uniqueWdIds = [...new Set(linkedAllocations.map((a) => a.withdrawalRequestId))].sort();
      if (uniqueWdIds.length > 0) {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "WithdrawalRequest" WHERE "id" IN (${Prisma.join(uniqueWdIds)}) ORDER BY "id" ASC FOR UPDATE`
        );
      }
    }

    if (allStoreEarningIds.length > 0) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "StoreEarning" WHERE "id" IN (${Prisma.join(allStoreEarningIds.sort())}) ORDER BY "id" ASC FOR UPDATE`
      );
    }
    if (allDriverEarningIds.length > 0) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "DriverEarning" WHERE "id" IN (${Prisma.join(allDriverEarningIds.sort())}) ORDER BY "id" ASC FOR UPDATE`
      );
    }

    const paymentAmountCents = Math.round(Number(payment.amount) * 100);
    const disputeAmountCents = Math.round(Number(amountDecimal) * 100);

    // Build raw original allocations
    const rawAllocations: RawParticipantAllocation[] = [];
    let allocatedRawCents = 0;

    for (const se of storeEarnings) {
      const sCents = Math.round(Number(se.amount) * 100);
      rawAllocations.push({
        participantType: "STORE",
        participantId: se.storeId,
        storeEarningId: se.id,
        originalAmountCents: sCents,
      });
      allocatedRawCents += sCents;
    }

    for (const de of driverEarnings) {
      const dCents = Math.round(Number(de.amount) * 100);
      rawAllocations.push({
        participantType: "DRIVER",
        participantId: de.driverId,
        driverEarningId: de.id,
        originalAmountCents: dCents,
      });
      allocatedRawCents += dCents;
    }

    const platformShareCents = Math.max(0, paymentAmountCents - allocatedRawCents);
    if (platformShareCents > 0 || rawAllocations.length === 0) {
      rawAllocations.push({
        participantType: "PLATFORM",
        participantId: "platform",
        originalAmountCents: platformShareCents > 0 ? platformShareCents : paymentAmountCents,
      });
    }

    // Calculate deterministic shares
    const allocations = calculateDisputeAllocations(rawAllocations, paymentAmountCents, disputeAmountCents);

    // Invariant check: sum(dispute exposure allocations) == disputeAmount
    const totalAllocatedCents = allocations.reduce((sum, a) => sum + a.allocatedAmountCents, 0);
    if (totalAllocatedCents !== disputeAmountCents) {
      throw new PaymentError("PAYMENT_AMOUNT_INVALID", `Allocation sum ${totalAllocatedCents} does not match dispute amount ${disputeAmountCents}`);
    }

    // Prepare platform accounts directly within transaction
    let platformWallet = await tx.wallet.findUnique({
      where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } },
    });
    if (!platformWallet) {
      platformWallet = await tx.wallet.create({
        data: {
          ownerType: "PLATFORM",
          ownerId: "platform",
          currency: "ZAR",
          status: "ACTIVE",
        },
      });
    }

    let platformCustomerHeld = await tx.ledgerAccount.findFirst({
      where: {
        walletId: platformWallet.id,
        purpose: "HELD",
        currency: "ZAR",
        status: "ACTIVE",
      },
    });
    if (!platformCustomerHeld) {
      platformCustomerHeld = await tx.ledgerAccount.create({
        data: {
          walletId: platformWallet.id,
          code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
          purpose: "HELD",
          category: "LIABILITY",
          currency: "ZAR",
          status: "ACTIVE",
        },
      });
    }

    let platformDisputeHeld = await tx.ledgerAccount.findFirst({
      where: {
        walletId: platformWallet.id,
        purpose: "SETTLEMENT_CLEARING",
        currency: "ZAR",
        status: "ACTIVE",
      },
    });
    if (!platformDisputeHeld) {
      platformDisputeHeld = await tx.ledgerAccount.create({
        data: {
          walletId: platformWallet.id,
          code: "PLATFORM-DISPUTE-HELD-ZAR",
          purpose: "SETTLEMENT_CLEARING",
          category: "LIABILITY",
          currency: "ZAR",
          status: "ACTIVE",
        },
      });
    }

    const publicReference = generateDisputePublicReference();
    const journalEntries: Array<{
      accountId: string;
      direction: "DEBIT" | "CREDIT";
      amount: string;
      lineCode: string;
    }> = [];

    interface PreparedAllocationRecord {
      publicReference: string;
      participantType: string;
      participantId: string;
      storeEarningId?: string;
      driverEarningId?: string;
      withdrawalEarningAllocationId?: string | null;
      allocatedAmount: Prisma.Decimal;
      heldAmount: Prisma.Decimal;
      recoveryReceivableAmount: Prisma.Decimal;
      holdingState: PaymentDisputeHoldingState;
      ledgerAccountId?: string | null;
    }

    const preparedAllocations: PreparedAllocationRecord[] = [];
    const cancelledWithdrawalIds = new Set<string>();
    let requiresReconciliation = false;

    for (let i = 0; i < allocations.length; i++) {
      const alloc = allocations[i];
      const allocDecimal = new Prisma.Decimal(alloc.allocatedAmountCents).div(100);
      const allocRef = generateAllocationPublicReference();
      const lineSuffix = `_${alloc.participantType}_${i + 1}`;

      if (alloc.participantType === "STORE") {
        const storeEarning = storeEarnings.find((s) => s.id === alloc.storeEarningId);
        const storeWallet = storeEarning?.walletId
          ? await tx.wallet.findUniqueOrThrow({ where: { id: storeEarning.walletId } })
          : await ensureWalletForOwner({
              ownerType: "STORE",
              ownerId: alloc.participantId,
              currency: "ZAR",
            });
        const storeDisputeHeld = await resolveOwnerDisputeHeldAccount(tx, storeWallet.id, "STORE", alloc.participantId);

        if (storeEarning?.status === "ACCRUED") {
          // Unreleased: Move liability from store payable to store dispute-held
          journalEntries.push(
            {
              accountId: storeEarning.payableAccountId,
              direction: "DEBIT",
              amount: allocDecimal.toFixed(2),
              lineCode: `STORE_PAYABLE_DISPUTE_RESERVE${lineSuffix}`,
            },
            {
              accountId: storeDisputeHeld.id,
              direction: "CREDIT",
              amount: allocDecimal.toFixed(2),
              lineCode: `STORE_DISPUTE_HELD_LIABILITY${lineSuffix}`,
            },
          );
          preparedAllocations.push({
            publicReference: allocRef,
            participantType: "STORE",
            participantId: alloc.participantId,
            storeEarningId: storeEarning.id,
            allocatedAmount: allocDecimal,
            heldAmount: allocDecimal,
            recoveryReceivableAmount: new Prisma.Decimal(0),
            holdingState: PaymentDisputeHoldingState.UNRELEASED_HELD,
            ledgerAccountId: storeDisputeHeld.id,
          });
        } else if (storeEarning?.status === "RELEASED") {
          // Released: Apply strict 4-tier provenance precedence
          // 1. externally settled first -> RECOVERY_RECEIVABLE
          // 2. in-flight/reserved second -> IN_FLIGHT_HOLD (or pre-provider cancelled -> RELEASED_HOLD)
          // 3. still available third -> RELEASED_HOLD
          const summary = await getEarningProvenanceSummary(tx, "STORE", storeEarning.id);
          const partitioned = partitionDisputedShareByProvenance(summary, alloc.allocatedAmountCents);

          // Tier 1: Externally settled
          for (let sIdx = 0; sIdx < partitioned.settled.length; sIdx++) {
            const sItem = partitioned.settled[sIdx];
            const sItemDecimal = new Prisma.Decimal(sItem.amountCents).div(100);
            const subRef = generateAllocationPublicReference();
            const subSuffix = `${lineSuffix}_SETTLED_${sIdx + 1}`;

            const storeReceivable = await resolveOwnerReceivableAccount(tx, storeWallet.id, "STORE", alloc.participantId);
            journalEntries.push(
              {
                accountId: storeReceivable.id,
                direction: "DEBIT",
                amount: sItemDecimal.toFixed(2),
                lineCode: `STORE_RECOVERY_RECEIVABLE${subSuffix}`,
              },
              {
                accountId: storeDisputeHeld.id,
                direction: "CREDIT",
                amount: sItemDecimal.toFixed(2),
                lineCode: `STORE_DISPUTE_HELD_LIABILITY${subSuffix}`,
              },
            );

            preparedAllocations.push({
              publicReference: subRef,
              participantType: "STORE",
              participantId: alloc.participantId,
              storeEarningId: storeEarning.id,
              withdrawalEarningAllocationId: sItem.allocationId,
              allocatedAmount: sItemDecimal,
              heldAmount: new Prisma.Decimal(0),
              recoveryReceivableAmount: sItemDecimal,
              holdingState: PaymentDisputeHoldingState.RECOVERY_RECEIVABLE,
              ledgerAccountId: storeDisputeHeld.id,
            });
          }

          // Tier 2A: Pre-provider cancellable withdrawals
          let preProviderHeldCents = 0;
          for (const pp of partitioned.preProviderReserved) {
            if (!cancelledWithdrawalIds.has(pp.withdrawalId)) {
              cancelledWithdrawalIds.add(pp.withdrawalId);
              const withdrawal = await tx.withdrawalRequest.findUnique({
                where: { id: pp.withdrawalId },
                include: { payoutDestination: true },
              });
              if (withdrawal && !withdrawal.releaseLedgerJournalId && !withdrawal.payoutLedgerJournalId) {
                await lockWithdrawalAccounts(tx, withdrawal);
                const releaseJournal = await postLedgerJournalWithinTransaction(
                  tx,
                  withdrawalReleasePosting({
                    withdrawalReference: withdrawal.publicReference,
                    amount: withdrawal.amount.toFixed(2),
                    sourceAccountId: withdrawal.sourceAccountId,
                    heldAccountId: withdrawal.heldAccountId,
                    actorUserId: input.actorUserId,
                    payoutDestinationReference: withdrawal.payoutDestination.publicReference,
                    ownerType: withdrawal.ownerType,
                    policyVersion: withdrawal.policyVersion,
                  }),
                );
                await tx.withdrawalRequest.update({
                  where: { id: withdrawal.id },
                  data: {
                    status: "CANCELLED",
                    releaseLedgerJournalId: releaseJournal.id,
                    cancelledByUserId: input.actorUserId ?? null,
                    cancelledAt: new Date(),
                    cancellationReasonCode: "DISPUTE_INTERCEPTED",
                    version: { increment: 1 },
                  },
                });
                await cancelWithdrawalEarningAllocations(tx, withdrawal.id);
                await tx.withdrawalStatusHistory.createMany({
                  data: [
                    {
                      withdrawalId: withdrawal.id,
                      fromStatus: withdrawal.status,
                      toStatus: "CANCELLED",
                      actorType: "SYSTEM",
                      actorUserId: input.actorUserId ?? null,
                      reasonCode: "DISPUTE_INTERCEPTED",
                    },
                    {
                      withdrawalId: withdrawal.id,
                      toStatus: "CANCELLED",
                      actorType: "SYSTEM",
                      reasonCode: "RESERVATION_RELEASED",
                      safeMetadata: { releaseJournalReference: releaseJournal.reference },
                    },
                  ],
                });
              }
            }
            preProviderHeldCents += pp.amountCents;
          }

          // Tier 2B: In-flight processing (preserve WITHDRAWAL_HELD intact, no hold journal, flag reconciliation)
          for (let ifIdx = 0; ifIdx < partitioned.inFlightProcessing.length; ifIdx++) {
            const ifItem = partitioned.inFlightProcessing[ifIdx];
            const ifItemDecimal = new Prisma.Decimal(ifItem.amountCents).div(100);
            const subRef = generateAllocationPublicReference();
            requiresReconciliation = true;

            preparedAllocations.push({
              publicReference: subRef,
              participantType: "STORE",
              participantId: alloc.participantId,
              storeEarningId: storeEarning.id,
              withdrawalEarningAllocationId: ifItem.allocationId,
              allocatedAmount: ifItemDecimal,
              heldAmount: new Prisma.Decimal(0),
              recoveryReceivableAmount: new Prisma.Decimal(0),
              holdingState: PaymentDisputeHoldingState.IN_FLIGHT_HOLD,
              ledgerAccountId: null,
            });
          }

          // Tier 3: Still available + pre-provider restored funds -> RELEASED_HOLD
          const totalAvailableHoldCents = partitioned.availableCents + preProviderHeldCents;
          if (totalAvailableHoldCents > 0) {
            const availDecimal = new Prisma.Decimal(totalAvailableHoldCents).div(100);
            const subRef = generateAllocationPublicReference();
            const storeWithdrawable = await resolveOwnerWithdrawableAccount(tx, storeWallet.id);

            journalEntries.push(
              {
                accountId: storeWithdrawable.id,
                direction: "DEBIT",
                amount: availDecimal.toFixed(2),
                lineCode: `STORE_AVAILABLE_DISPUTE_HOLD${lineSuffix}`,
              },
              {
                accountId: storeDisputeHeld.id,
                direction: "CREDIT",
                amount: availDecimal.toFixed(2),
                lineCode: `STORE_DISPUTE_HELD_LIABILITY${lineSuffix}`,
              },
            );

            preparedAllocations.push({
              publicReference: subRef,
              participantType: "STORE",
              participantId: alloc.participantId,
              storeEarningId: storeEarning.id,
              allocatedAmount: availDecimal,
              heldAmount: availDecimal,
              recoveryReceivableAmount: new Prisma.Decimal(0),
              holdingState: PaymentDisputeHoldingState.RELEASED_HOLD,
              ledgerAccountId: storeDisputeHeld.id,
            });
          }
        }
      } else if (alloc.participantType === "DRIVER") {
        const driverEarning = driverEarnings.find((d) => d.id === alloc.driverEarningId);
        const driverWallet = await ensureWalletForOwner({
          ownerType: "DRIVER",
          ownerId: alloc.participantId,
          currency: "ZAR",
        });
        const driverDisputeHeld = await resolveOwnerDisputeHeldAccount(tx, driverWallet.id, "DRIVER", alloc.participantId);

        if (driverEarning?.status === "ACCRUED") {
          journalEntries.push(
            {
              accountId: driverEarning.payableAccountId,
              direction: "DEBIT",
              amount: allocDecimal.toFixed(2),
              lineCode: `DRIVER_PAYABLE_DISPUTE_RESERVE${lineSuffix}`,
            },
            {
              accountId: driverDisputeHeld.id,
              direction: "CREDIT",
              amount: allocDecimal.toFixed(2),
              lineCode: `DRIVER_DISPUTE_HELD_LIABILITY${lineSuffix}`,
            },
          );
          preparedAllocations.push({
            publicReference: allocRef,
            participantType: "DRIVER",
            participantId: alloc.participantId,
            driverEarningId: driverEarning.id,
            allocatedAmount: allocDecimal,
            heldAmount: allocDecimal,
            recoveryReceivableAmount: new Prisma.Decimal(0),
            holdingState: PaymentDisputeHoldingState.UNRELEASED_HELD,
            ledgerAccountId: driverDisputeHeld.id,
          });
        } else if (driverEarning?.status === "RELEASED") {
          const summary = await getEarningProvenanceSummary(tx, "DRIVER", driverEarning.id);
          const partitioned = partitionDisputedShareByProvenance(summary, alloc.allocatedAmountCents);

          // Tier 1: Externally settled
          for (let sIdx = 0; sIdx < partitioned.settled.length; sIdx++) {
            const sItem = partitioned.settled[sIdx];
            const sItemDecimal = new Prisma.Decimal(sItem.amountCents).div(100);
            const subRef = generateAllocationPublicReference();
            const subSuffix = `${lineSuffix}_SETTLED_${sIdx + 1}`;

            const driverReceivable = await resolveOwnerReceivableAccount(tx, driverWallet.id, "DRIVER", alloc.participantId);
            journalEntries.push(
              {
                accountId: driverReceivable.id,
                direction: "DEBIT",
                amount: sItemDecimal.toFixed(2),
                lineCode: `DRIVER_RECOVERY_RECEIVABLE${subSuffix}`,
              },
              {
                accountId: driverDisputeHeld.id,
                direction: "CREDIT",
                amount: sItemDecimal.toFixed(2),
                lineCode: `DRIVER_DISPUTE_HELD_LIABILITY${subSuffix}`,
              },
            );

            preparedAllocations.push({
              publicReference: subRef,
              participantType: "DRIVER",
              participantId: alloc.participantId,
              driverEarningId: driverEarning.id,
              withdrawalEarningAllocationId: sItem.allocationId,
              allocatedAmount: sItemDecimal,
              heldAmount: new Prisma.Decimal(0),
              recoveryReceivableAmount: sItemDecimal,
              holdingState: PaymentDisputeHoldingState.RECOVERY_RECEIVABLE,
              ledgerAccountId: driverDisputeHeld.id,
            });
          }

          // Tier 2A: Pre-provider cancellable withdrawals
          let preProviderHeldCents = 0;
          for (const pp of partitioned.preProviderReserved) {
            if (!cancelledWithdrawalIds.has(pp.withdrawalId)) {
              cancelledWithdrawalIds.add(pp.withdrawalId);
              const withdrawal = await tx.withdrawalRequest.findUnique({
                where: { id: pp.withdrawalId },
                include: { payoutDestination: true },
              });
              if (withdrawal && !withdrawal.releaseLedgerJournalId && !withdrawal.payoutLedgerJournalId) {
                await lockWithdrawalAccounts(tx, withdrawal);
                const releaseJournal = await postLedgerJournalWithinTransaction(
                  tx,
                  withdrawalReleasePosting({
                    withdrawalReference: withdrawal.publicReference,
                    amount: withdrawal.amount.toFixed(2),
                    sourceAccountId: withdrawal.sourceAccountId,
                    heldAccountId: withdrawal.heldAccountId,
                    actorUserId: input.actorUserId,
                    payoutDestinationReference: withdrawal.payoutDestination.publicReference,
                    ownerType: withdrawal.ownerType,
                    policyVersion: withdrawal.policyVersion,
                  }),
                );
                await tx.withdrawalRequest.update({
                  where: { id: withdrawal.id },
                  data: {
                    status: "CANCELLED",
                    releaseLedgerJournalId: releaseJournal.id,
                    cancelledByUserId: input.actorUserId ?? null,
                    cancelledAt: new Date(),
                    cancellationReasonCode: "DISPUTE_INTERCEPTED",
                    version: { increment: 1 },
                  },
                });
                await cancelWithdrawalEarningAllocations(tx, withdrawal.id);
                await tx.withdrawalStatusHistory.createMany({
                  data: [
                    {
                      withdrawalId: withdrawal.id,
                      fromStatus: withdrawal.status,
                      toStatus: "CANCELLED",
                      actorType: "SYSTEM",
                      actorUserId: input.actorUserId ?? null,
                      reasonCode: "DISPUTE_INTERCEPTED",
                    },
                    {
                      withdrawalId: withdrawal.id,
                      toStatus: "CANCELLED",
                      actorType: "SYSTEM",
                      reasonCode: "RESERVATION_RELEASED",
                      safeMetadata: { releaseJournalReference: releaseJournal.reference },
                    },
                  ],
                });
              }
            }
            preProviderHeldCents += pp.amountCents;
          }

          // Tier 2B: In-flight processing
          for (let ifIdx = 0; ifIdx < partitioned.inFlightProcessing.length; ifIdx++) {
            const ifItem = partitioned.inFlightProcessing[ifIdx];
            const ifItemDecimal = new Prisma.Decimal(ifItem.amountCents).div(100);
            const subRef = generateAllocationPublicReference();
            requiresReconciliation = true;

            preparedAllocations.push({
              publicReference: subRef,
              participantType: "DRIVER",
              participantId: alloc.participantId,
              driverEarningId: driverEarning.id,
              withdrawalEarningAllocationId: ifItem.allocationId,
              allocatedAmount: ifItemDecimal,
              heldAmount: new Prisma.Decimal(0),
              recoveryReceivableAmount: new Prisma.Decimal(0),
              holdingState: PaymentDisputeHoldingState.IN_FLIGHT_HOLD,
              ledgerAccountId: null,
            });
          }

          // Tier 3: Still available + pre-provider restored funds -> RELEASED_HOLD
          const totalAvailableHoldCents = partitioned.availableCents + preProviderHeldCents;
          if (totalAvailableHoldCents > 0) {
            const availDecimal = new Prisma.Decimal(totalAvailableHoldCents).div(100);
            const subRef = generateAllocationPublicReference();
            const driverWithdrawable = await resolveOwnerWithdrawableAccount(tx, driverWallet.id);

            journalEntries.push(
              {
                accountId: driverWithdrawable.id,
                direction: "DEBIT",
                amount: availDecimal.toFixed(2),
                lineCode: `DRIVER_AVAILABLE_DISPUTE_HOLD${lineSuffix}`,
              },
              {
                accountId: driverDisputeHeld.id,
                direction: "CREDIT",
                amount: availDecimal.toFixed(2),
                lineCode: `DRIVER_DISPUTE_HELD_LIABILITY${lineSuffix}`,
              },
            );

            preparedAllocations.push({
              publicReference: subRef,
              participantType: "DRIVER",
              participantId: alloc.participantId,
              driverEarningId: driverEarning.id,
              allocatedAmount: availDecimal,
              heldAmount: availDecimal,
              recoveryReceivableAmount: new Prisma.Decimal(0),
              holdingState: PaymentDisputeHoldingState.RELEASED_HOLD,
              ledgerAccountId: driverDisputeHeld.id,
            });
          }
        }
      } else {
        // PLATFORM
        journalEntries.push(
          {
            accountId: platformCustomerHeld.id,
            direction: "DEBIT",
            amount: allocDecimal.toFixed(2),
            lineCode: `PLATFORM_CUSTOMER_FUNDS_DISPUTE_RESERVE${lineSuffix}`,
          },
          {
            accountId: platformDisputeHeld.id,
            direction: "CREDIT",
            amount: allocDecimal.toFixed(2),
            lineCode: `PLATFORM_DISPUTE_HELD_LIABILITY${lineSuffix}`,
          },
        );

        preparedAllocations.push({
          publicReference: allocRef,
          participantType: "PLATFORM",
          participantId: "platform",
          allocatedAmount: allocDecimal,
          heldAmount: allocDecimal,
          recoveryReceivableAmount: new Prisma.Decimal(0),
          holdingState: PaymentDisputeHoldingState.PLATFORM_HELD,
          ledgerAccountId: platformDisputeHeld.id,
        });
      }
    }

    // 4. Post hold journal enforcing exact balance (if entries exist)
    const consolidatedEntries = consolidateJournalEntries(journalEntries);
    let holdJournal: { id: string; reference: string } | null = null;

    if (consolidatedEntries.length > 0) {
      holdJournal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `dispute-hold:${publicReference}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `payment:${payment.publicReference}:dispute:${publicReference}`,
        correlationId: publicReference,
        memo: `Dispute hold for payment ${payment.publicReference} (${input.reason ?? "OTHER"})`,
        actor: input.actorUserId ? { kind: "USER", userId: input.actorUserId } : { kind: "SYSTEM" },
        metadata: {
          paymentPublicReference: payment.publicReference,
          disputePublicReference: publicReference,
          providerDisputeId: input.providerDisputeId ?? null,
        },
        entries: consolidatedEntries,
      });
    }

    // 5. Create PaymentDispute and PaymentDisputeAllocation records
    let disputeReason: PaymentDisputeReason = PaymentDisputeReason.OTHER;
    if (input.reason) {
      const upper = String(input.reason).toUpperCase();
      if (Object.values(PaymentDisputeReason).includes(upper as PaymentDisputeReason)) {
        disputeReason = upper as PaymentDisputeReason;
      }
    }

    const dispute = await tx.paymentDispute.create({
      data: {
        publicReference,
        providerDisputeId: input.providerDisputeId ?? null,
        paymentId: payment.id,
        provider: payment.provider ?? "PAYSTACK",
        amount: amountDecimal,
        currency: "ZAR",
        status: "OPEN",
        reason: disputeReason,
        providerStatus: input.providerStatus ?? "open",
        evidenceDueBy: evidenceDue,
        safeEvidenceSnapshot: sanitizedEvidence as unknown as Prisma.InputJsonValue | undefined,
        holdLedgerJournalId: holdJournal?.id ?? null,
        reconciliationRequired: requiresReconciliation,
        history: {
          create: {
            fromStatus: null,
            toStatus: "OPEN",
            actorType: input.actorType ?? "PROVIDER",
            actorUserId: input.actorUserId ?? null,
            reasonCode: input.reason ?? "OTHER",
            safeMetadata: {
              holdLedgerJournalReference: holdJournal?.reference ?? null,
              amount: amountDecimal.toFixed(2),
              allocationCount: String(preparedAllocations.length),
              reconciliationRequired: String(requiresReconciliation),
            },
          },
        },
        allocations: {
          create: preparedAllocations.map((p) => ({
            publicReference: p.publicReference,
            participantType: p.participantType,
            participantId: p.participantId,
            storeEarningId: p.storeEarningId,
            driverEarningId: p.driverEarningId,
            withdrawalEarningAllocationId: p.withdrawalEarningAllocationId ?? null,
            allocatedAmount: p.allocatedAmount,
            heldAmount: p.heldAmount,
            recoveryReceivableAmount: p.recoveryReceivableAmount,
            currency: "ZAR",
            holdingState: p.holdingState,
            ledgerAccountId: p.ledgerAccountId,
            holdJournalId: holdJournal?.id ?? null,
          })),
        },
      },
      include: { history: true, allocations: true },
    });

    // 6. Update payment reconciliation status
    await tx.payment.update({
      where: { id: payment.id },
      data: { reconciliationStatus: "REQUIRED" },
    });

    return dispute;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

// ─── Update Evidence ──────────────────────────────────────────────────────────

export async function updatePaymentDisputeEvidence(input: UpdatePaymentDisputeEvidenceInput) {
  const sanitizedEvidence = sanitizeEvidenceSnapshot(input.safeEvidence);
  const evidenceDue = input.evidenceDueBy ? new Date(input.evidenceDueBy) : undefined;

  return prisma.$transaction(async (tx) => {
    let dispute = null;
    if (input.disputeId) {
      dispute = await tx.paymentDispute.findUnique({ where: { id: input.disputeId }, include: { allocations: true } });
    } else if (input.disputePublicReference) {
      dispute = await tx.paymentDispute.findUnique({ where: { publicReference: input.disputePublicReference }, include: { allocations: true } });
    } else if (input.providerDisputeId) {
      dispute = await tx.paymentDispute.findUnique({ where: { providerDisputeId: input.providerDisputeId }, include: { allocations: true } });
    }

    if (!dispute) {
      throw new PaymentError("PAYMENT_NOT_FOUND", "Payment dispute could not be found.");
    }

    const updated = await tx.paymentDispute.update({
      where: { id: dispute.id },
      data: {
        evidenceDueBy: evidenceDue ?? dispute.evidenceDueBy,
        providerStatus: input.providerStatus ?? dispute.providerStatus,
        safeEvidenceSnapshot: sanitizedEvidence
          ? (sanitizedEvidence as unknown as Prisma.InputJsonValue)
          : (dispute.safeEvidenceSnapshot ?? undefined),
        history: {
          create: {
            fromStatus: dispute.status,
            toStatus: dispute.status,
            actorType: input.actorType ?? "SYSTEM",
            actorUserId: input.actorUserId ?? null,
            reasonCode: "EVIDENCE_UPDATED",
            safeMetadata: {
              evidenceDueBy: (evidenceDue ?? dispute.evidenceDueBy)?.toISOString() ?? null,
              providerStatus: input.providerStatus ?? dispute.providerStatus,
            },
          },
        },
      },
      include: { history: true, allocations: true },
    });

    return updated;
  });
}

// ─── Resolve Payment Dispute ──────────────────────────────────────────────────

export async function resolvePaymentDispute(input: ResolvePaymentDisputeInput) {
  return prisma.$transaction(async (tx) => {
    let dispute = null;
    if (input.disputeId) {
      dispute = await tx.paymentDispute.findUnique({
        where: { id: input.disputeId },
        include: { allocations: { include: { storeEarning: true, driverEarning: true } } },
      });
    } else if (input.disputePublicReference) {
      dispute = await tx.paymentDispute.findUnique({
        where: { publicReference: input.disputePublicReference },
        include: { allocations: { include: { storeEarning: true, driverEarning: true } } },
      });
    } else if (input.providerDisputeId) {
      dispute = await tx.paymentDispute.findUnique({
        where: { providerDisputeId: input.providerDisputeId },
        include: { allocations: { include: { storeEarning: true, driverEarning: true } } },
      });
    }

    if (!dispute) {
      throw new PaymentError("PAYMENT_NOT_FOUND", "Payment dispute could not be found.");
    }

    // Idempotency: If already settled, do not re-settle or duplicate ledger entries
    if (dispute.status === "WON" || dispute.status === "LOST" || dispute.status === "RESOLVED") {
      return dispute;
    }

    const platformWallet = await ensureWalletForOwner({
      ownerType: "PLATFORM",
      ownerId: "platform",
      currency: "ZAR",
    });

    const platformCustomerHeld = await ensureLedgerAccount({
      walletId: platformWallet.id,
      code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
      purpose: "HELD",
      category: "LIABILITY",
      currency: "ZAR",
    });

    const platformCashClearing = await ensureLedgerAccount({
      walletId: platformWallet.id,
      code: "PLATFORM-CASH-CLEARING-ZAR",
      purpose: "CASH_CLEARING",
      category: "ASSET",
      currency: "ZAR",
    });

    const now = new Date();
    const targetStatus: PaymentDisputeStatus = input.resolution === "WON" ? "WON" : "LOST";
    const journalEntries: Array<{
      accountId: string;
      direction: "DEBIT" | "CREDIT";
      amount: string;
      lineCode: string;
    }> = [];

    const settledAllocations: Array<{ id: string }> = [];
    let hasPendingInFlight = false;

    for (let i = 0; i < dispute.allocations.length; i++) {
      const alloc = dispute.allocations[i];
      const amountStr = alloc.allocatedAmount.toFixed(2);
      const lineSuffix = `_${alloc.participantType}_${i + 1}`;

      if (input.resolution === "WON") {
        // WON: Release hold back to original participant account
        if (alloc.holdingState === PaymentDisputeHoldingState.UNRELEASED_HELD) {
          const payableAccountId = alloc.storeEarning?.payableAccountId ?? alloc.driverEarning?.payableAccountId;
          if (payableAccountId && alloc.ledgerAccountId) {
            journalEntries.push(
              {
                accountId: alloc.ledgerAccountId,
                direction: "DEBIT",
                amount: amountStr,
                lineCode: `DISPUTE_WON_RELEASE_HELD${lineSuffix}`,
              },
              {
                accountId: payableAccountId,
                direction: "CREDIT",
                amount: amountStr,
                lineCode: `DISPUTE_WON_RESTORE_PAYABLE${lineSuffix}`,
              },
            );
          }
          settledAllocations.push({ id: alloc.id });
        } else if (alloc.holdingState === PaymentDisputeHoldingState.RELEASED_HOLD) {
          const participantWallet = await ensureWalletForOwner({
            ownerType: alloc.participantType as "STORE" | "DRIVER",
            ownerId: alloc.participantId ?? "unknown",
            currency: "ZAR",
          });
          const withdrawableAccount = await resolveOwnerWithdrawableAccount(tx, participantWallet.id);
          if (alloc.ledgerAccountId) {
            journalEntries.push(
              {
                accountId: alloc.ledgerAccountId,
                direction: "DEBIT",
                amount: amountStr,
                lineCode: `DISPUTE_WON_RELEASE_HELD${lineSuffix}`,
              },
              {
                accountId: withdrawableAccount.id,
                direction: "CREDIT",
                amount: amountStr,
                lineCode: `DISPUTE_WON_RESTORE_AVAILABLE${lineSuffix}`,
              },
            );
          }
          settledAllocations.push({ id: alloc.id });
        } else if (alloc.holdingState === PaymentDisputeHoldingState.RECOVERY_RECEIVABLE) {
          const participantWallet = await ensureWalletForOwner({
            ownerType: alloc.participantType as "STORE" | "DRIVER",
            ownerId: alloc.participantId ?? "unknown",
            currency: "ZAR",
          });
          const receivableAccount = await resolveOwnerReceivableAccount(tx, participantWallet.id, alloc.participantType as "STORE" | "DRIVER", alloc.participantId ?? "unknown");
          if (alloc.ledgerAccountId) {
            journalEntries.push(
              {
                accountId: alloc.ledgerAccountId,
                direction: "DEBIT",
                amount: amountStr,
                lineCode: `DISPUTE_WON_CLEAR_DISPUTE_HELD${lineSuffix}`,
              },
              {
                accountId: receivableAccount.id,
                direction: "CREDIT",
                amount: amountStr,
                lineCode: `DISPUTE_WON_CLEAR_RECEIVABLE${lineSuffix}`,
              },
            );
          }
          settledAllocations.push({ id: alloc.id });
        } else if (alloc.holdingState === PaymentDisputeHoldingState.PLATFORM_HELD) {
          if (alloc.ledgerAccountId) {
            journalEntries.push(
              {
                accountId: alloc.ledgerAccountId,
                direction: "DEBIT",
                amount: amountStr,
                lineCode: `DISPUTE_WON_RELEASE_PLATFORM_HELD${lineSuffix}`,
              },
              {
                accountId: platformCustomerHeld.id,
                direction: "CREDIT",
                amount: amountStr,
                lineCode: `DISPUTE_WON_RESTORE_PLATFORM_FUNDS${lineSuffix}`,
              },
            );
          }
          settledAllocations.push({ id: alloc.id });
        } else if (alloc.holdingState === PaymentDisputeHoldingState.IN_FLIGHT_HOLD) {
          // When dispute is WON, clear IN_FLIGHT_HOLD dispute claim with settledAt = now
          // (no ledger release journal since none was posted to DISPUTE_HELD)
          settledAllocations.push({ id: alloc.id });
        }
      } else {
        // LOST
        if (alloc.holdingState === PaymentDisputeHoldingState.IN_FLIGHT_HOLD) {
          // In-flight processing remains pending / reconciliation-required until withdrawal settles/fails
          hasPendingInFlight = true;
        } else {
          // Provider deducted chargeback from platform cash clearing; clear held liability
          if (alloc.ledgerAccountId) {
            journalEntries.push(
              {
                accountId: alloc.ledgerAccountId,
                direction: "DEBIT",
                amount: amountStr,
                lineCode: `DISPUTE_LOST_CLEAR_HELD${lineSuffix}`,
              },
              {
                accountId: platformCashClearing.id,
                direction: "CREDIT",
                amount: amountStr,
                lineCode: `DISPUTE_LOST_PROVIDER_CLEARING_DEDUCTION${lineSuffix}`,
              },
            );
          }
          settledAllocations.push({ id: alloc.id });
        }
      }
    }

    const consolidatedEntries = consolidateJournalEntries(journalEntries);
    let resolutionJournal: { id: string; reference: string } | null = null;

    if (consolidatedEntries.length > 0) {
      resolutionJournal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `dispute-resolve-${input.resolution.toLowerCase()}:${dispute.publicReference}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `dispute:${dispute.publicReference}:${input.resolution.toLowerCase()}`,
        correlationId: dispute.publicReference,
        memo: `Dispute ${input.resolution.toLowerCase()}; settled allocations for ${dispute.publicReference}`,
        actor: input.actorUserId ? { kind: "USER", userId: input.actorUserId } : { kind: "SYSTEM" },
        metadata: {
          disputePublicReference: dispute.publicReference,
          providerDisputeId: dispute.providerDisputeId,
          resolution: input.resolution,
          allocationCount: String(dispute.allocations.length),
        },
        entries: consolidatedEntries,
      });
    }

    // Update dispute status and mark settled allocations
    const updated = await tx.paymentDispute.update({
      where: { id: dispute.id },
      data: {
        status: targetStatus,
        resolvedAt: now,
        lossLedgerJournalId: input.resolution === "LOST" ? (resolutionJournal?.id ?? dispute.lossLedgerJournalId) : dispute.lossLedgerJournalId,
        reconciliationRequired: hasPendingInFlight,
        history: {
          create: {
            fromStatus: dispute.status,
            toStatus: targetStatus,
            actorType: input.actorType ?? "SYSTEM",
            actorUserId: input.actorUserId ?? null,
            reasonCode: `DISPUTE_${input.resolution}`,
            safeMetadata: {
              resolutionJournalReference: resolutionJournal?.reference ?? null,
              resolution: input.resolution,
              amount: dispute.amount.toFixed(2),
              hasPendingInFlight: String(hasPendingInFlight),
            },
          },
        },
      },
      include: { history: true, allocations: true },
    });

    for (const alloc of settledAllocations) {
      await tx.paymentDisputeAllocation.update({
        where: { id: alloc.id },
        data: {
          settledAt: now,
          settlementJournalId: resolutionJournal?.id ?? null,
        },
      });
    }

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
