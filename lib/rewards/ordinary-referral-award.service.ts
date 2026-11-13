import { createHash } from "node:crypto";
import { Prisma, SystemSettingType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import type { LedgerActor } from "@/lib/ledger/types";
import { loadCustomerRewardPolicy } from "./customer-reward-configuration";
import { ordinaryReferralReward } from "./customer-reward-policy";
import { inspectOrdinaryReferralEligibility } from "./ordinary-referral-eligibility.service";
import { ORDINARY_REFERRAL_SOURCE } from "./ordinary-referral.service";
import { ORDINARY_REFERRAL_LEDGER_INCLUDE, verifyOrdinaryReferralAwardJournal } from "./ordinary-referral-ledger-evidence";
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
  if (!input.actorUserId) throw new OrdinaryReferralAwardError("INVALID_EVENT", "An operator and referral event are required.");
  return awardOrdinaryReferral({ referralEventId: input.referralEventId, operationId: input.operationId, actor: { kind: "USER", userId: input.actorUserId } });
}

async function awardOrdinaryReferral(input: Readonly<{
  referralEventId: string;
  operationId: string;
  actor: LedgerActor;
}>) {
  if (!input.referralEventId || input.referralEventId.length > 200 ||
      typeof input.operationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,95}$/.test(input.operationId)) {
    throw new OrdinaryReferralAwardError("INVALID_EVENT", "An operator and referral event are required.");
  }
  const operationDigest = referenceHash(input.operationId);
  const digest = referenceHash(input.referralEventId);
  const key = `ordinary-referral-award-${digest}`;
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    const [operator, event] = await Promise.all([
      input.actor.kind === "USER"
        ? tx.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, status: true } })
        : Promise.resolve(null),
      tx.referralEvent.findUnique({
        where: { id: input.referralEventId }, include: { referralCode: true },
      }),
    ]);
    if (input.actor.kind === "USER" && (operator?.role !== "SUPER_ADMIN" || operator.status !== "ACTIVE")) {
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
        where: { id: existingJournalId }, include: ORDINARY_REFERRAL_LEDGER_INCLUDE,
      });
      if (!journal) throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Reward receipt is missing.");
      let proof;
      try {
        proof = verifyOrdinaryReferralAwardJournal(event, journal, digest);
      } catch {
        throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Reward journal does not belong to this referral.");
      }
      if (proof.operationDigest !== operationDigest) {
        throw new OrdinaryReferralAwardError("EVIDENCE_CONFLICT", "Reward operation ID does not match its issued receipt.");
      }
      return Object.freeze({
        status: "REPLAYED" as const,
        journalId: journal.id, journalReference: journal.reference,
        referralEventId: event.id,
        amountZar: proof.amountZar,
        qualifyingPaymentId: proof.qualifyingPaymentId,
      });
    }
    if (event.status !== "PENDING") {
      throw new OrdinaryReferralAwardError("NOT_ELIGIBLE", "The referral is no longer pending.");
    }
    if (!["CUSTOMER", "STORE"].includes(event.referralCode.ownerType)) {
      throw new OrdinaryReferralAwardError("NOT_ELIGIBLE", "This is not a customer or store referral.");
    }
    if (input.actor.kind === "USER" && event.targetUserId === input.actor.userId) {
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
    if (!owner?.referrerUserId || (input.actor.kind === "USER" && owner.referrerUserId === input.actor.userId)) {
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
      actor: input.actor,
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
        actorUserId: input.actor.kind === "USER" ? input.actor.userId : null, entityType: "ReferralEvent",
        entityId: event.id, action: "UPDATE",
        message: "Verified ordinary first-paid-order referral credited to wallet",
        metadata: {
          journalId: journal.id, qualifyingPaymentId: eligibility.qualifyingPaymentId,
          rewardOperationDigest: operationDigest,
          ownerType: owner.ownerType, rewardAmountZar: amount, actorKind: input.actor.kind,
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

export async function processAutomaticOrdinaryReferralAwards(options?: {
  batchSize?: number;
  actorUserId?: string;
}) {
  const batchSize = options?.batchSize ?? 50;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 200) {
    throw new Error("Invalid batch size for automatic referral award processor.");
  }

  const issuing = await prisma.systemSetting.findUnique({
    where: { key: "referral.reward_issuing_enabled" }, select: { type: true, value: true },
  });
  if (issuing?.type !== SystemSettingType.BOOLEAN || issuing.value !== true) {
    return {
      itemsExamined: 0, itemsAwarded: 0, itemsSkipped: 0, itemsFailed: 0,
      safeSummary: "Ordinary referral issuing is disabled; no referrals were modified.",
    };
  }

  const pendingEvents = await prisma.referralEvent.findMany({
    where: {
      source: ORDINARY_REFERRAL_SOURCE,
      status: "PENDING",
      targetUserId: { not: null },
    },
    take: batchSize,
    // Revisit the least recently examined pending referrals first. An unpaid
    // signup may remain pending indefinitely and must not block later users.
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
  });

  let awarded = 0;
  let skipped = 0;
  let failed = 0;

  for (const event of pendingEvents) {
    let outcome: "AWARDED" | "SKIPPED" | "FAILED" = "SKIPPED";
    try {
      const priorRewarded = await prisma.referralEvent.count({
        where: {
          targetUserId: event.targetUserId,
          status: "REWARDED",
        },
      });
      if (priorRewarded === 0) {
        const eligibility = await inspectOrdinaryReferralEligibility(event.id);
        if (eligibility.eligible) {
          const eventClean = event.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
          const paymentClean = (eligibility.qualifyingPaymentId ?? "first").replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
          const operationId = `auto-referral-${eventClean}-${paymentClean}`;
          const actor: LedgerActor = options?.actorUserId
            ? { kind: "USER", userId: options.actorUserId }
            : { kind: "SYSTEM" };
          const result = await awardOrdinaryReferral({ referralEventId: event.id, actor, operationId });
          if (result.status === "CREDITED") outcome = "AWARDED";
        }
      }
    } catch {
      outcome = "FAILED";
    }
    if (outcome !== "AWARDED") {
      try {
        // Only rotate the unchanged pending record. A concurrent award or edit
        // must never be overwritten by this non-financial scan marker.
        await prisma.referralEvent.updateMany({
          where: { id: event.id, source: ORDINARY_REFERRAL_SOURCE, status: "PENDING", updatedAt: event.updatedAt },
          data: { updatedAt: new Date(Math.max(Date.now(), event.updatedAt.getTime() + 1)) },
        });
      } catch {
        outcome = "FAILED";
      }
    }
    if (outcome === "AWARDED") awarded++;
    else if (outcome === "FAILED") failed++;
    else skipped++;
  }

  return {
    itemsExamined: pendingEvents.length,
    itemsAwarded: awarded,
    itemsSkipped: skipped,
    itemsFailed: failed,
    safeSummary: `Automatic referral processing: ${awarded} awarded, ${skipped} skipped, ${failed} failed.`,
  };
}

