import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { buildReversalEntries } from "@/lib/ledger/reversal-policy";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { ORDINARY_REFERRAL_PAYMENT_INCLUDE } from "./ordinary-referral-eligibility.service";
import { ORDINARY_REFERRAL_LEDGER_INCLUDE, verifyOrdinaryReferralAwardJournal } from "./ordinary-referral-ledger-evidence";
import { ORDINARY_REFERRAL_SOURCE } from "./ordinary-referral.service";
import { OrdinaryReferralAwardError } from "./ordinary-referral-award.service";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}
function record(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown> : {};
}

/** Invert an actual R5 ordinary referral only after its source payment is
 * refunded or disputed. This does not initiate the customer's refund,
 * withdraw to a bank or create a new incentive. Ledger and event state must
 * either both commit or both roll back. An exhausted wallet is not allowed
 * to become negative: finance must handle a separate recovery case.
 */
export async function reverseRefundedOrdinaryReferral(input: Readonly<{
  referralEventId: string;
  actorUserId: string;
  operationId: string;
}>) {
  if (!input.actorUserId || !input.referralEventId || input.referralEventId.length > 200 ||
      typeof input.operationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,95}$/.test(input.operationId)) {
    throw new OrdinaryReferralAwardError("INVALID_EVENT", "A valid reversal operator, event and operation are required.");
  }
  const digest = hash(input.referralEventId);
  const operationDigest = hash(input.operationId);
  const key = `ordinary-referral-reversal-${digest}`;
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    const [actor, event] = await Promise.all([
      tx.user.findUnique({ where: { id: input.actorUserId }, select: { role: true, status: true } }),
      tx.referralEvent.findUnique({ where: { id: input.referralEventId }, include: { referralCode: true } }),
    ]);
    if (actor?.role !== "SUPER_ADMIN" || actor.status !== "ACTIVE") {
      throw new OrdinaryReferralAwardError("FORBIDDEN", "Only an active superuser may reverse a verified referral credit.");
    }
    if (!event || event.source !== ORDINARY_REFERRAL_SOURCE || !event.targetUserId) {
      throw new OrdinaryReferralAwardError("INVALID_EVENT", "Ordinary referral attribution does not exist.");
    }
    const metadata = record(event.metadata);
    if (event.status === "CANCELLED" && typeof metadata.rewardReversalJournalId === "string") {
      const reversal = await tx.ledgerJournal.findUnique({
        where: { id: metadata.rewardReversalJournalId },
        select: { id: true, reference: true, idempotencyKey: true, reversalOfJournalId: true },
      });
      if (!reversal || reversal.idempotencyKey !== key ||
          reversal.reversalOfJournalId !== metadata.rewardJournalId ||
          metadata.rewardReversalOperationDigest !== operationDigest) {
        throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Reversal receipt does not match the original reward operation.");
      }
      return Object.freeze({
        status: "REPLAYED" as const, referralEventId: event.id,
        journalId: reversal.id, journalReference: reversal.reference,
      });
    }
    if (event.status !== "REWARDED" || typeof metadata.rewardJournalId !== "string") {
      throw new OrdinaryReferralAwardError("NOT_ELIGIBLE", "The referral has no issued wallet reward to reverse.");
    }
    if (event.targetUserId === input.actorUserId ||
        event.referralCode.ownerId === input.actorUserId) {
      throw new OrdinaryReferralAwardError("FORBIDDEN", "The reward beneficiary cannot reverse their own award.");
    }
    const original = await tx.ledgerJournal.findUnique({
      where: { id: metadata.rewardJournalId }, include: ORDINARY_REFERRAL_LEDGER_INCLUDE,
    });
    if (!original) throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "The issued reward journal was not found.");
    let proof;
    try {
      proof = verifyOrdinaryReferralAwardJournal(event, original, digest);
    } catch {
      throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Original referral wallet evidence is inconsistent.");
    }
    if (original.reversalJournal) {
      throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "The reward has already been reversed outside its referral receipt.");
    }
    const paid = await tx.payment.findUnique({
      where: { id: proof.qualifyingPaymentId },
      include: ORDINARY_REFERRAL_PAYMENT_INCLUDE,
    });
    if (!paid || paid.userId !== event.targetUserId || paid.purpose !== "ORDER" ||
        !["COURIER_ORDER", "MARKETPLACE_CHECKOUT"].includes(paid.subjectType)) {
      throw new OrdinaryReferralAwardError("NOT_ELIGIBLE", "The original referral payment owner is not valid.");
    }
    // A refund reservation is not a refund. Require a persisted SUCCEEDED
    // refund receipt paired with the paid amount projection, or an actual
    // linked dispute record. The original award journal has already been
    // independently verified above, including its source payment identity.
    const refunded = paid.totalRefundedAmount.gt(0);
    const completedRefund = refunded ? await tx.paymentRefund.findFirst({
      where: { paymentId: paid.id, status: "SUCCEEDED" }, select: { id: true },
    }) : null;
    if ((refunded && !completedRefund) || (!completedRefund && paid.disputes.length === 0)) {
      throw new OrdinaryReferralAwardError("NOT_ELIGIBLE",
        "Only a completed refund or an actual payment dispute authorizes reversal of the original referral award.");
    }
    const reversal = await postLedgerJournalWithinTransaction(tx, {
      idempotencyKey: key,
      type: "REVERSAL", currency: "ZAR",
      sourceReference: `REVERSAL:${original.reference}`,
      correlationId: event.id,
      actor: { kind: "USER", userId: input.actorUserId },
      reversalOfJournalId: original.id,
      memo: "Original paid order was refunded or disputed: reversing the ordinary referral wallet award.",
      metadata: {
        category: "ORDINARY_REFERRAL_REVERSAL",
        originalJournalId: original.id, qualifyingPaymentId: paid.id,
        reversalOperationDigest: operationDigest, sourceEvidence: "REFUND_OR_DISPUTE",
      },
      entries: buildReversalEntries(original),
    });
    const changed = await tx.referralEvent.updateMany({
      where: { id: event.id, status: "REWARDED", source: ORDINARY_REFERRAL_SOURCE },
      data: {
        status: "CANCELLED",
        metadata: {
          ...metadata,
          rewardReversalJournalId: reversal.id,
          rewardReversalOperationDigest: operationDigest,
          reversalCause: "SOURCE_REFUND_OR_DISPUTE",
        },
      },
    });
    if (changed.count !== 1) {
      throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Referral reward changed during reversal.");
    }
    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.actorUserId, action: "UPDATE",
        entityType: "ReferralEvent", entityId: event.id,
        message: "Reversed ordinary referral award after verified source refund or dispute",
        metadata: { reversalJournalId: reversal.id, originalJournalId: original.id,
          qualifyingPaymentId: paid.id, amountZar: proof.amountZar },
      },
    });
    return Object.freeze({
      status: "REVERSED" as const, referralEventId: event.id,
      journalId: reversal.id, journalReference: reversal.reference,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }));
}
