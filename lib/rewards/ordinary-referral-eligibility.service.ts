import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ORDINARY_REFERRAL_PROGRAM, ORDINARY_REFERRAL_SOURCE } from "./ordinary-referral.service";
import { sameReferralPhone } from "./ordinary-referral-phone";
import {
  verifyOrdinaryReferralPaymentEvidence, type OrdinaryReferralFinancialStatus,
} from "./ordinary-referral-financial-evidence";

export const ORDINARY_REFERRAL_PAYMENT_INCLUDE = {
      successfulAttempt: true, successWebhookEvent: true,
      successLedgerJournal: { include: {
        entries: { include: { account: { select: { code: true, purpose: true, category: true } } } },
      } },
      disputes: { select: { id: true } },
      order: { select: { id: true, customerId: true, status: true, cashOnDelivery: {
        select: { cashObligation: true, status: true },
      } } },
      marketplaceOrder: { select: {
        id: true, customerUserId: true, status: true, cashRequired: true,
        storeOrders: { select: { status: true, derivedStatus: true, financialResolutionStatus: true } },
      } },
    } satisfies Prisma.PaymentInclude;

type Eligibility = Readonly<{
  eligible: boolean;
  reason: string;
  referralEventId: string;
  qualifyingPaymentId: string | null;
  evidenceStatus: OrdinaryReferralFinancialStatus | null;
}>;

/** Read-only operator preflight, never a payout command. This observes the
 * first paid order across both commerce channels; it cannot create money,
 * guarantee a future entitlement or bypass an independent finance signoff.
 */
export async function inspectOrdinaryReferralEligibility(
  referralEventId: string, db: Prisma.TransactionClient = prisma,
): Promise<Eligibility> {
  const respond = (reason: string, paymentId: string | null = null, evidenceStatus: OrdinaryReferralFinancialStatus | null = null): Eligibility =>
    Object.freeze({
      eligible: reason === "VERIFIED_FIRST_PAID_ORDER",
      reason, referralEventId, qualifyingPaymentId: paymentId, evidenceStatus,
    });
  if (!referralEventId.trim() || referralEventId.length > 200) return respond("INVALID_REFERRAL");

  const event = await db.referralEvent.findUnique({
    where: { id: referralEventId },
    include: { referralCode: true, targetUser: {
      select: { id: true, role: true, status: true, email: true, phone: true, createdAt: true },
    } },
  });
  if (!event || event.source !== ORDINARY_REFERRAL_SOURCE || event.status !== "PENDING" ||
      !event.targetUserId || !event.targetUser || event.targetUser.status !== "ACTIVE" ||
      event.targetUser.role !== event.targetType ||
      !event.referralCode.isActive ||
      !["CUSTOMER", "STORE"].includes(event.referralCode.ownerType) ||
      !event.referralCode.metadata || typeof event.referralCode.metadata !== "object" ||
      Array.isArray(event.referralCode.metadata) ||
      (event.referralCode.metadata as Record<string, unknown>).program !== ORDINARY_REFERRAL_PROGRAM) {
    return respond("INELIGIBLE_REFERRAL");
  }
  const referrer = event.referralCode.ownerType === "CUSTOMER"
    ? await db.user.findFirst({ where: {
        id: event.referralCode.ownerId, status: "ACTIVE", role: "CUSTOMER",
      }, select: { id: true, email: true, phone: true } })
    : await db.store.findFirst({ where: {
        id: event.referralCode.ownerId, status: "ACTIVE",
        ownerUser: { status: "ACTIVE", role: "STORE" },
      }, select: { ownerUser: { select: { id: true, email: true, phone: true } } } })
      .then(row => row?.ownerUser ?? null);
  if (!referrer || referrer.id === event.targetUserId ||
      referrer.email.toLowerCase() === event.targetUser.email.toLowerCase() ||
      sameReferralPhone(referrer.phone, event.targetUser.phone)) {
    return respond("INELIGIBLE_REFERRER");
  }

  // Once the first paid source exists, a later order never qualifies in its
  // place. A failed/forged original receipt is an investigation case, not an
  // invitation to claim a payout against a newer payment.
  const payment = await db.payment.findFirst({
    where: {
      userId: event.targetUserId, status: "SUCCEEDED",
      subjectType: { in: ["COURIER_ORDER", "MARKETPLACE_CHECKOUT"] },
    },
    // Null-success timestamps fail closed as the first candidate rather
    // than allowing a later successful payment to mask historical drift.
    orderBy: [{ succeededAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    include: ORDINARY_REFERRAL_PAYMENT_INCLUDE,
  });
  if (!payment) return respond("NO_SUCCESSFUL_PAYMENT");
  if (payment.succeededAt && payment.succeededAt < event.createdAt) {
    return respond("PAYMENT_PREDATES_ATTRIBUTION", payment.id);
  }
  const status = verifyOrdinaryReferralPaymentEvidence(payment, event.targetUserId);
  if (status !== "VERIFIED_FIRST_PAID_ORDER") return respond(status, payment.id, status);
  return respond("VERIFIED_FIRST_PAID_ORDER", payment.id, status);
}
