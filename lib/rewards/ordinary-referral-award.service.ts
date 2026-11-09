import { createHash } from "node:crypto";
import { Prisma, SystemSettingType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { loadCustomerRewardPolicy } from "./customer-reward-configuration";
import { ordinaryReferralReward } from "./customer-reward-policy";
import { inspectOrdinaryReferralEligibility } from "./ordinary-referral-eligibility.service";
import { ORDINARY_REFERRAL_SOURCE } from "./ordinary-referral.service";
import { ensureLedgerAccountInTx, ensureWalletForOwnerInTx } from "@/lib/services/wallet-account.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { PROMOTION_ACCOUNT_CODES } from "@/lib/promotions/promotion-ledger-policy";

export class OrdinaryReferralAwardError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "DISABLED" | "NOT_ELIGIBLE" | "INVALID_EVENT" | "EVIDENCE_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "OrdinaryReferralAwardError";
  }
}

function referenceHash(id: string) {
  return createHash("sha256").update(id).digest("hex").toUpperCase();
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

/** Explicit finance-controlled issuance, not a signup reward or a Paystack
 * redirect callback. Only an independently verified, completed *first* paid
 * order can create a nonwithdrawable wallet liability, and the referral state,
 * immutable journal and admin audit commit atomically.
 *
 * Launch control defaults OFF. This service is not a scheduled payout worker:
 * post-payment reconciliation and chargeback reversals still require a
 * separate approved lifecycle before fully automatic rewards may be enabled.
 */
export async function awardVerifiedOrdinaryReferral(input: Readonly<{
  referralEventId: string;
  actorUserId: string;
  operationId: string;
}>) {
  if (!input.actorUserId || !input.referralEventId || input.referralEventId.length > 200 ||
      typeof input.operationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,95}$/.test(input.operationId)) {
    throw new OrdinaryReferralAwardError("INVALID_EVENT", "An operator and referral event are required.");
  }
  const operationDigest = referenceHash(input.operationId);
  const digest = referenceHash(input.referralEventId);
  const key = `ordinary-referral-award-${digest}`;
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    const [operator, event] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.actorUserId }, select: { role: true, status: true },
      }),
      tx.referralEvent.findUnique({
        where: { id: input.referralEventId }, include: { referralCode: true },
      }),
    ]);
    if (operator?.role !== "SUPER_ADMIN" || operator.status !== "ACTIVE") {
      throw new OrdinaryReferralAwardError("FORBIDDEN", "Only an active finance-authorized superuser may issue ordinary referral credit.");
    }
    if (!event || event.source !== ORDINARY_REFERRAL_SOURCE || !event.targetUserId) {
      throw new OrdinaryReferralAwardError("INVALID_EVENT", "Ordinary referral attribution does not exist.");
    }

    // Replay is always read-only, including after an operator switches issuing
    // OFF. Validate the immutable source journal rather than trusting JSON.
    if (event.status === "REWARDED") {
      const existing = record(event.metadata);
      const existingJournalId = existing.rewardJournalId;
      if (typeof existingJournalId !== "string" || existing.rewardOperationDigest !== operationDigest) {
        throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Reward status has no ledger receipt.");
      }
      const journal = await tx.ledgerJournal.findUnique({
        where: { id: existingJournalId },
        include: { entries: { include: { account: { include: { wallet: true } } } } },
      });
      const credited = journal?.entries.find(entry => entry.direction === "CREDIT");
      const charged = journal?.entries.find(entry => entry.direction === "DEBIT");
      const ownerType = event.referralCode.ownerType;
      const ownerId = event.referralCode.ownerId;
      const expectedPurpose = ownerType === "CUSTOMER" ? "CUSTOMER_WALLET_AVAILABLE"
        : ownerType === "STORE" ? "STORE_REFERRAL_WALLET_AVAILABLE" : null;
      const amount = typeof existing.rewardAmountZar === "string"
        && /^\d+\.\d{2}$/.test(existing.rewardAmountZar)
        ? new Prisma.Decimal(existing.rewardAmountZar) : null;
      const source = record(journal?.metadata);
      if (!journal || !amount || !amount.gt(0) || !expectedPurpose ||
          journal.sourceReference !== `ORDINARY_REFERRAL:${digest}` ||
          journal.idempotencyKey !== key || journal.type !== "GENERAL" ||
          journal.currency !== "ZAR" || journal.entries.length !== 2 ||
          !journal.totalDebits.equals(amount) || !journal.totalCredits.equals(amount) ||
          !credited || credited.account.purpose !== expectedPurpose ||
          credited.account.category !== "LIABILITY" ||
          credited.account.wallet.ownerType !== ownerType ||
          credited.account.wallet.ownerId !== ownerId ||
          !credited.amount.equals(amount) ||
          !charged || charged.account.purpose !== "PLATFORM_PROMOTION_EXPENSE" ||
          charged.account.category !== "EXPENSE" ||
          charged.account.wallet.ownerType !== "PLATFORM" ||
          charged.account.wallet.ownerId !== "platform" ||
          !charged.amount.equals(amount) ||
          existing.recipientOwnerType !== ownerType || existing.recipientOwnerId !== ownerId ||
          source.category !== "ORDINARY_REFERRAL_AWARD" ||
          source.referralEventId !== event.id ||
          source.qualifyingPaymentId !== existing.qualifyingPaymentId ||
          source.rewardOperationDigest !== operationDigest) {
        throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Reward ledger evidence does not match the referral.");
      }
      return Object.freeze({
        status: "REPLAYED" as const,
        journalId: journal.id, journalReference: journal.reference,
        referralEventId: event.id,
        amountZar: String(existing.rewardAmountZar),
        qualifyingPaymentId: String(existing.qualifyingPaymentId),
      });
    }
    if (event.status !== "PENDING") {
      throw new OrdinaryReferralAwardError("NOT_ELIGIBLE", "The referral is no longer pending.");
    }
    if (!["CUSTOMER", "STORE"].includes(event.referralCode.ownerType)) {
      throw new OrdinaryReferralAwardError("NOT_ELIGIBLE", "This is not a customer or store referral.");
    }
    if (event.targetUserId === input.actorUserId) {
      throw new OrdinaryReferralAwardError("FORBIDDEN", "The referred account cannot issue its own credit.");
    }
    // Both a referrer and the referred account must remain active; the
    // source preflight also rejects phone/email alias self-referrals.
    const owner = event.referralCode.ownerType === "CUSTOMER"
      ? { ownerType: "CUSTOMER" as const, ownerId: event.referralCode.ownerId, referrerUserId: event.referralCode.ownerId }
      : await tx.store.findUnique({
          where: { id: event.referralCode.ownerId },
          select: { id: true, ownerUserId: true },
        }).then(store => store && ({
          ownerType: "STORE" as const, ownerId: store.id, referrerUserId: store.ownerUserId,
        }));
    if (!owner?.referrerUserId || owner.referrerUserId === input.actorUserId) {
      throw new OrdinaryReferralAwardError("FORBIDDEN", "Referral recipients must be separate from the issuing superuser.");
    }

    const setting = await tx.systemSetting.findUnique({
      where: { key: "referral.reward_issuing_enabled" },
      select: { type: true, value: true },
    });
    if (setting?.type !== SystemSettingType.BOOLEAN || setting.value !== true) {
      throw new OrdinaryReferralAwardError("DISABLED", "Ordinary referral financial awards are disabled pending finance authorization.");
    }

    // Recheck exact provider receipt, first-payment identity, refund and
    // completed-delivery state *inside* the serializable money transaction.
    const eligibility = await inspectOrdinaryReferralEligibility(event.id, tx);
    if (!eligibility.eligible || !eligibility.qualifyingPaymentId) {
      throw new OrdinaryReferralAwardError("NOT_ELIGIBLE", `Referral source is not qualified: ${eligibility.reason}.`);
    }
    const policy = await loadCustomerRewardPolicy(tx);
    const amount = ordinaryReferralReward({
      referrerOwnerType: owner.ownerType, referrerUserId: owner.referrerUserId,
      referredUserId: event.targetUserId,
      verifiedFirstPaidOrder: true, qualifyingPaidOrderCount: 1,
      previouslyRewardedReferredUser: false, rewardZar: policy.referralRewardZar,
    });
    if (!amount) throw new OrdinaryReferralAwardError("NOT_ELIGIBLE", "The configured referral amount cannot be awarded.");

    const wallet = await ensureWalletForOwnerInTx(tx, { ownerType: owner.ownerType, ownerId: owner.ownerId, currency: "ZAR" });
    const ownerHash = referenceHash(owner.ownerId).slice(0, 24);
    const available = await ensureLedgerAccountInTx(tx, {
      walletId: wallet.id,
      code: owner.ownerType === "CUSTOMER" ? `CUSTOMER-${ownerHash}-WALLET-ZAR` : `STORE-${ownerHash}-REFERRAL-ZAR`,
      purpose: owner.ownerType === "CUSTOMER" ? "CUSTOMER_WALLET_AVAILABLE" : "STORE_REFERRAL_WALLET_AVAILABLE",
      category: "LIABILITY", currency: "ZAR",
    });
    const platformWallet = await ensureWalletForOwnerInTx(tx, {
      ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR",
    });
    const expense = await ensureLedgerAccountInTx(tx, {
      walletId: platformWallet.id, code: PROMOTION_ACCOUNT_CODES.PLATFORM_EXPENSE,
      purpose: "PLATFORM_PROMOTION_EXPENSE", category: "EXPENSE", currency: "ZAR",
    });
    const journal = await postLedgerJournalWithinTransaction(tx, {
      idempotencyKey: key, type: "GENERAL", currency: "ZAR",
      sourceReference: `ORDINARY_REFERRAL:${digest}`,
      correlationId: event.id,
      actor: { kind: "USER", userId: input.actorUserId },
      memo: "Verified first-paid-order ordinary referral, nonwithdrawable wallet credit.",
      metadata: {
        category: "ORDINARY_REFERRAL_AWARD",
        referralEventId: event.id, qualifyingPaymentId: eligibility.qualifyingPaymentId,
        rewardOperationDigest: operationDigest,
        referredUserId: event.targetUserId, recipientOwnerType: owner.ownerType,
        recipientOwnerId: owner.ownerId, policyRewardZar: amount,
      },
      entries: [
        { accountId: expense.id, direction: "DEBIT", amount, lineCode: "REFERRAL-PLATFORM-EXPENSE" },
        { accountId: available.id, direction: "CREDIT", amount, lineCode: "REFERRER-WALLET-CREDIT" },
      ],
    });
    const now = new Date();
    const change = await tx.referralEvent.updateMany({
      where: { id: event.id, status: "PENDING", source: ORDINARY_REFERRAL_SOURCE },
      data: {
        status: "REWARDED", qualifiedAt: now, rewardedAt: now,
        metadata: {
          ...record(event.metadata), program: "ORDINARY_REFERRAL_V1",
          rewardJournalId: journal.id,
          rewardOperationDigest: operationDigest,
          rewardAmountZar: amount,
          qualifyingPaymentId: eligibility.qualifyingPaymentId,
          recipientOwnerType: owner.ownerType, recipientOwnerId: owner.ownerId,
        },
      },
    });
    if (change.count !== 1) {
      throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Referral state changed during financial award.");
    }
    await tx.adminActivityLog.create({
      data: {
        actorUserId: input.actorUserId, entityType: "ReferralEvent",
        entityId: event.id, action: "UPDATE",
        message: "Verified ordinary first-paid-order referral credited to wallet",
        metadata: {
          journalId: journal.id, qualifyingPaymentId: eligibility.qualifyingPaymentId,
          rewardOperationDigest: operationDigest,
          ownerType: owner.ownerType, rewardAmountZar: amount,
        },
      },
    });
    return Object.freeze({
      status: "CREDITED" as const, referralEventId: event.id,
      journalId: journal.id, journalReference: journal.reference,
      qualifyingPaymentId: eligibility.qualifyingPaymentId, amountZar: amount,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }));
}
