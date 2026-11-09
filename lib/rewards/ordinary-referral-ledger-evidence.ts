import { Prisma } from "@prisma/client";

export const ORDINARY_REFERRAL_LEDGER_INCLUDE = {
  entries: { include: { account: { include: { wallet: true } } } },
  reversalJournal: { select: { id: true, idempotencyKey: true } },
} satisfies Prisma.LedgerJournalInclude;

export type OrdinaryReferralJournal = Prisma.LedgerJournalGetPayload<{
  include: typeof ORDINARY_REFERRAL_LEDGER_INCLUDE;
}>;

type AwardEvent = Readonly<{
  id: string;
  targetUserId: string | null;
  referralCode: Readonly<{ ownerType: string; ownerId: string }>;
  metadata: unknown;
}>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export class OrdinaryReferralJournalEvidenceError extends Error {
  constructor(message = "Ordinary referral financial source evidence is not canonical.") {
    super(message);
    this.name = "OrdinaryReferralJournalEvidenceError";
  }
}

/** A replay or a reversal never trusts the mutable ReferralEvent metadata
 * alone. The amount, journal source, immutable reward operation, original
 * ledger entries and actual wallet owner MUST agree.
 */
export function verifyOrdinaryReferralAwardJournal(
  event: AwardEvent,
  journal: OrdinaryReferralJournal | null,
  sourceDigest: string,
): Readonly<{ amountZar: string; qualifyingPaymentId: string; operationDigest: string }> {
  const meta = asRecord(event.metadata);
  const amount = typeof meta.rewardAmountZar === "string"
    && /^(?:0|[1-9]\d*)\.\d{2}$/.test(meta.rewardAmountZar)
    ? new Prisma.Decimal(meta.rewardAmountZar) : null;
  const ownerType = event.referralCode.ownerType;
  const ownerId = event.referralCode.ownerId;
  const purpose = ownerType === "CUSTOMER" ? "CUSTOMER_WALLET_AVAILABLE"
    : ownerType === "STORE" ? "STORE_REFERRAL_WALLET_AVAILABLE" : null;
  const credited = journal?.entries.find(entry => entry.direction === "CREDIT");
  const charged = journal?.entries.find(entry => entry.direction === "DEBIT");
  const source = asRecord(journal?.metadata);
  if (!event.targetUserId || !amount || !amount.isFinite() || !amount.gt(0) ||
      !purpose || typeof meta.qualifyingPaymentId !== "string" ||
      typeof meta.rewardOperationDigest !== "string" ||
      meta.rewardJournalId !== journal?.id || !journal ||
      journal.sourceReference !== `ORDINARY_REFERRAL:${sourceDigest}` ||
      journal.idempotencyKey !== `ordinary-referral-award-${sourceDigest}` ||
      journal.type !== "GENERAL" || journal.currency !== "ZAR" ||
      journal.entries.length !== 2 ||
      !journal.totalDebits.equals(amount) || !journal.totalCredits.equals(amount) ||
      !credited || !charged || !credited.amount.equals(amount) || !charged.amount.equals(amount) ||
      credited.account.purpose !== purpose || credited.account.category !== "LIABILITY" ||
      credited.account.wallet.ownerType !== ownerType || credited.account.wallet.ownerId !== ownerId ||
      charged.account.purpose !== "PLATFORM_PROMOTION_EXPENSE" ||
      charged.account.category !== "EXPENSE" ||
      charged.account.wallet.ownerType !== "PLATFORM" || charged.account.wallet.ownerId !== "platform" ||
      meta.recipientOwnerType !== ownerType || meta.recipientOwnerId !== ownerId ||
      source.category !== "ORDINARY_REFERRAL_AWARD" ||
      source.referralEventId !== event.id ||
      source.referredUserId !== event.targetUserId ||
      source.recipientOwnerType !== ownerType ||
      source.recipientOwnerId !== ownerId ||
      source.qualifyingPaymentId !== meta.qualifyingPaymentId ||
      source.rewardOperationDigest !== meta.rewardOperationDigest ||
      source.policyRewardZar !== meta.rewardAmountZar) {
    throw new OrdinaryReferralJournalEvidenceError();
  }
  return Object.freeze({
    amountZar: amount.toFixed(2),
    qualifyingPaymentId: meta.qualifyingPaymentId,
    operationDigest: meta.rewardOperationDigest,
  });
}
