import { randomBytes } from "node:crypto";
import { Prisma, PaymentDisputeReason, PaymentDisputeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { PaymentError } from "@/lib/payments/errors";

export { PaymentDisputeReason, PaymentDisputeStatus };

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

const REDACTED_KEYS = new Set([
  "pan",
  "card_number",
  "cardnumber",
  "cvv",
  "cvv2",
  "pin",
  "password",
  "secret",
  "token",
  "auth_code",
  "authorization_code",
  "account_number",
  "bank_account",
]);

export function sanitizeEvidenceSnapshot(
  evidence?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!evidence || typeof evidence !== "object") return null;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(evidence)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("secret")) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeEvidenceSnapshot(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function generateDisputePublicReference(): string {
  return `pds_${randomBytes(12).toString("hex")}`;
}

async function getDisputeLedgerAccounts() {
  const platformWallet = await ensureWalletForOwner({
    ownerType: "PLATFORM",
    ownerId: "platform",
    currency: "ZAR",
  });

  const [disputeHeld, customerHeld, suspense, cashClearing] = await Promise.all([
    ensureLedgerAccount({
      walletId: platformWallet.id,
      code: "PLATFORM-DISPUTE-HELD-ZAR",
      purpose: "HELD",
      category: "LIABILITY",
      currency: "ZAR",
    }),
    ensureLedgerAccount({
      walletId: platformWallet.id,
      code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
      purpose: "HELD",
      category: "LIABILITY",
      currency: "ZAR",
    }),
    ensureLedgerAccount({
      walletId: platformWallet.id,
      code: "PLATFORM-DISPUTE-SUSPENSE-ZAR",
      purpose: "SUSPENSE",
      category: "EXPENSE",
      currency: "ZAR",
    }),
    ensureLedgerAccount({
      walletId: platformWallet.id,
      code: "PLATFORM-CASH-CLEARING-ZAR",
      purpose: "CASH_CLEARING",
      category: "ASSET",
      currency: "ZAR",
    }),
  ]);

  return { disputeHeld, customerHeld, suspense, cashClearing };
}

export async function openPaymentDispute(input: OpenPaymentDisputeInput) {
  const amountDecimal = new Prisma.Decimal(input.amount);
  if (amountDecimal.isNegative() || amountDecimal.isZero() || !amountDecimal.isFinite()) {
    throw new PaymentError("PAYMENT_AMOUNT_INVALID", "Dispute amount must be a positive number.");
  }

  const sanitizedEvidence = sanitizeEvidenceSnapshot(input.safeEvidence);
  const evidenceDue = input.evidenceDueBy ? new Date(input.evidenceDueBy) : null;

  return prisma.$transaction(async (tx) => {
    // 1. Idempotency check on providerDisputeId
    if (input.providerDisputeId) {
      const existing = await tx.paymentDispute.findUnique({
        where: { providerDisputeId: input.providerDisputeId },
        include: { history: true },
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Find target Payment
    let payment = null;
    if (input.paymentId) {
      payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    } else if (input.paymentPublicReference) {
      payment = await tx.payment.findUnique({ where: { publicReference: input.paymentPublicReference } });
    }

    if (!payment) {
      throw new PaymentError("PAYMENT_NOT_FOUND", "Payment associated with dispute could not be found.");
    }

    const accounts = await getDisputeLedgerAccounts();
    const publicReference = generateDisputePublicReference();

    // 3. Post dispute hold in ledger
    // Debit PLATFORM-CUSTOMER-FUNDS-HELD-ZAR, Credit PLATFORM-DISPUTE-HELD-ZAR
    const holdJournal = await postLedgerJournalWithinTransaction(tx, {
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
      entries: [
        {
          accountId: accounts.customerHeld.id,
          direction: "DEBIT",
          amount: amountDecimal.toFixed(2),
          lineCode: "CUSTOMER_FUNDS_DISPUTE_RESERVE",
        },
        {
          accountId: accounts.disputeHeld.id,
          direction: "CREDIT",
          amount: amountDecimal.toFixed(2),
          lineCode: "DISPUTE_HELD_LIABILITY",
        },
      ],
    });

    // 4. Create PaymentDispute record
    const dispute = await tx.paymentDispute.create({
      data: {
        publicReference,
        providerDisputeId: input.providerDisputeId ?? null,
        paymentId: payment.id,
        provider: payment.provider ?? "PAYSTACK",
        amount: amountDecimal,
        currency: "ZAR",
        status: "OPEN",
        reason: input.reason ?? "OTHER",
        providerStatus: input.providerStatus ?? "open",
        evidenceDueBy: evidenceDue,
        safeEvidenceSnapshot: sanitizedEvidence as Prisma.InputJsonValue | undefined,
        holdLedgerJournalId: holdJournal.id,
        history: {
          create: {
            fromStatus: null,
            toStatus: "OPEN",
            actorType: input.actorType ?? "PROVIDER",
            actorUserId: input.actorUserId ?? null,
            reasonCode: input.reason ?? "OTHER",
            safeMetadata: {
              holdLedgerJournalReference: holdJournal.reference,
              amount: amountDecimal.toFixed(2),
            },
          },
        },
      },
      include: { history: true },
    });

    // 5. Update payment reconciliation status if not already required
    await tx.payment.update({
      where: { id: payment.id },
      data: { reconciliationStatus: "REQUIRED" },
    });

    return dispute;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updatePaymentDisputeEvidence(input: UpdatePaymentDisputeEvidenceInput) {
  const sanitizedEvidence = sanitizeEvidenceSnapshot(input.safeEvidence);
  const evidenceDue = input.evidenceDueBy ? new Date(input.evidenceDueBy) : undefined;

  return prisma.$transaction(async (tx) => {
    let dispute = null;
    if (input.disputeId) {
      dispute = await tx.paymentDispute.findUnique({ where: { id: input.disputeId } });
    } else if (input.disputePublicReference) {
      dispute = await tx.paymentDispute.findUnique({ where: { publicReference: input.disputePublicReference } });
    } else if (input.providerDisputeId) {
      dispute = await tx.paymentDispute.findUnique({ where: { providerDisputeId: input.providerDisputeId } });
    }

    if (!dispute) {
      throw new PaymentError("PAYMENT_NOT_FOUND", "Payment dispute could not be found.");
    }

    const updated = await tx.paymentDispute.update({
      where: { id: dispute.id },
      data: {
        evidenceDueBy: evidenceDue ?? dispute.evidenceDueBy,
        providerStatus: input.providerStatus ?? dispute.providerStatus,
        status: dispute.status === "OPEN" ? "UNDER_REVIEW" : dispute.status,
        safeEvidenceSnapshot: sanitizedEvidence
          ? (sanitizedEvidence as Prisma.InputJsonValue)
          : dispute.safeEvidenceSnapshot ?? undefined,
        lastSynchronizedAt: new Date(),
        history: {
          create: {
            fromStatus: dispute.status,
            toStatus: dispute.status === "OPEN" ? "UNDER_REVIEW" : dispute.status,
            actorType: input.actorType ?? "PROVIDER",
            actorUserId: input.actorUserId ?? null,
            reasonCode: "EVIDENCE_UPDATED",
            safeMetadata: {
              evidenceDueBy: evidenceDue?.toISOString(),
              providerStatus: input.providerStatus,
            },
          },
        },
      },
      include: { history: true },
    });

    return updated;
  });
}

export async function resolvePaymentDispute(input: ResolvePaymentDisputeInput) {
  return prisma.$transaction(async (tx) => {
    let dispute = null;
    if (input.disputeId) {
      dispute = await tx.paymentDispute.findUnique({ where: { id: input.disputeId }, include: { payment: true } });
    } else if (input.disputePublicReference) {
      dispute = await tx.paymentDispute.findUnique({ where: { publicReference: input.disputePublicReference }, include: { payment: true } });
    } else if (input.providerDisputeId) {
      dispute = await tx.paymentDispute.findUnique({ where: { providerDisputeId: input.providerDisputeId }, include: { payment: true } });
    }

    if (!dispute) {
      throw new PaymentError("PAYMENT_NOT_FOUND", "Payment dispute could not be found.");
    }

    // Idempotent if already resolved
    if (dispute.status === "WON" || dispute.status === "LOST" || dispute.status === "RESOLVED") {
      return dispute;
    }

    const accounts = await getDisputeLedgerAccounts();
    const now = new Date();
    const targetStatus: PaymentDisputeStatus = input.resolution === "WON" ? "WON" : "LOST";

    let resolutionJournal = null;

    if (input.resolution === "WON") {
      // Platform / merchant won dispute: release held dispute liability back to customer held
      resolutionJournal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `dispute-resolve-won:${dispute.publicReference}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `dispute:${dispute.publicReference}:won`,
        correlationId: dispute.publicReference,
        memo: `Dispute won; released dispute reserve for ${dispute.publicReference}`,
        actor: input.actorUserId ? { kind: "USER", userId: input.actorUserId } : { kind: "SYSTEM" },
        metadata: {
          disputePublicReference: dispute.publicReference,
          providerDisputeId: dispute.providerDisputeId,
          resolution: "WON",
        },
        entries: [
          {
            accountId: accounts.disputeHeld.id,
            direction: "DEBIT",
            amount: dispute.amount.toFixed(2),
            lineCode: "DISPUTE_HELD_RELEASED",
          },
          {
            accountId: accounts.customerHeld.id,
            direction: "CREDIT",
            amount: dispute.amount.toFixed(2),
            lineCode: "CUSTOMER_FUNDS_RESTORED",
          },
        ],
      });
    } else {
      // Customer won dispute / chargeback lost: provider debits platform cash clearing
      resolutionJournal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `dispute-resolve-lost:${dispute.publicReference}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `dispute:${dispute.publicReference}:lost`,
        correlationId: dispute.publicReference,
        memo: `Dispute lost; chargeback deducted from platform cash for ${dispute.publicReference}`,
        actor: input.actorUserId ? { kind: "USER", userId: input.actorUserId } : { kind: "SYSTEM" },
        metadata: {
          disputePublicReference: dispute.publicReference,
          providerDisputeId: dispute.providerDisputeId,
          resolution: "LOST",
        },
        entries: [
          {
            accountId: accounts.disputeHeld.id,
            direction: "DEBIT",
            amount: dispute.amount.toFixed(2),
            lineCode: "DISPUTE_HELD_CLEARED",
          },
          {
            accountId: accounts.cashClearing.id,
            direction: "CREDIT",
            amount: dispute.amount.toFixed(2),
            lineCode: "PLATFORM_CASH_DEDUCTED_BY_PROVIDER",
          },
        ],
      });
    }

    const updated = await tx.paymentDispute.update({
      where: { id: dispute.id },
      data: {
        status: targetStatus,
        providerStatus: input.providerStatus ?? (input.resolution === "WON" ? "won" : "lost"),
        resolvedAt: now,
        lossLedgerJournalId: input.resolution === "LOST" ? resolutionJournal.id : null,
        history: {
          create: {
            fromStatus: dispute.status,
            toStatus: targetStatus,
            actorType: input.actorType ?? "PROVIDER",
            actorUserId: input.actorUserId ?? null,
            reasonCode: input.resolution === "WON" ? "DISPUTE_RESOLVED_WON" : "DISPUTE_RESOLVED_LOST",
            safeMetadata: {
              resolutionLedgerJournalReference: resolutionJournal.reference,
              resolution: input.resolution,
            },
          },
        },
      },
      include: { history: true },
    });

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getPaymentDispute(identifier: { id?: string; publicReference?: string; providerDisputeId?: string }) {
  if (identifier.id) {
    return prisma.paymentDispute.findUnique({
      where: { id: identifier.id },
      include: { history: { orderBy: { createdAt: "asc" } }, payment: true },
    });
  }
  if (identifier.publicReference) {
    return prisma.paymentDispute.findUnique({
      where: { publicReference: identifier.publicReference },
      include: { history: { orderBy: { createdAt: "asc" } }, payment: true },
    });
  }
  if (identifier.providerDisputeId) {
    return prisma.paymentDispute.findUnique({
      where: { providerDisputeId: identifier.providerDisputeId },
      include: { history: { orderBy: { createdAt: "asc" } }, payment: true },
    });
  }
  return null;
}

export async function listPaymentDisputes(filter: {
  paymentId?: string;
  status?: PaymentDisputeStatus;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.PaymentDisputeWhereInput = {};
  if (filter.paymentId) where.paymentId = filter.paymentId;
  if (filter.status) where.status = filter.status;

  return prisma.paymentDispute.findMany({
    where,
    include: { history: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 50,
    skip: filter.offset ?? 0,
  });
}
