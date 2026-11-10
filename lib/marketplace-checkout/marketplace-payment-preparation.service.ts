import { prisma } from "@/lib/db/prisma";
import { assertNewMarketplacePaymentPolicyReady } from "@/lib/marketplace-checkout/marketplace-fulfilment-readiness";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";
import { isLocalFullFlowAllowed } from "@/lib/testing/safe-postgres-validator";
import { prepareMarketplacePayment as preparePhase10MarketplacePayment, type MarketplacePaymentPreparationCommand } from "@/lib/services/payment-preparation.service";
import { prepareMarketplacePaystackCustomerAction } from "@/lib/marketplace-checkout/marketplace-paystack-checkout.service";

export type MarketplacePaymentPreparationResult = Readonly<{
  paymentReference: string;
  paymentId: string;
  amount: string;
  currency: "ZAR";
  providerAction:
    | Readonly<{ type: "FORM_POST"; endpoint: string; fields: Readonly<Record<string, string>> }>
    | Readonly<{ type: "REDIRECT_GET"; endpoint: string }>
    | null;
  replayed: boolean;
  walletSettled?: boolean;
}>;

export interface MarketplacePaymentOrchestrator {
  prepareMarketplacePayment(input: Readonly<{
    checkoutId: string; checkoutReference: string; customerUserId: string | null;
    guestAccessTokenHash: string | null; payerEmail: string; amount: string; currency: "ZAR";
    commercialFingerprint: string; operationId: string; walletAmount?: string | null;
  }>): Promise<MarketplacePaymentPreparationResult>;
  /** Resume the EXISTING canonical payment, not a new financial intent. */
  resumeMarketplaceProviderAction?(input: Readonly<{
    paymentId: string; paymentReference: string; payerEmail: string;
    operationId: string; guestCheckoutEvidence: boolean;
  }>): Promise<MarketplacePaymentPreparationResult["providerAction"]>;
}

/** Provider I/O happens OUTSIDE the canonical Payment service's DB transaction. */
export function createPhase10And11MarketplacePaymentOrchestrator(): MarketplacePaymentOrchestrator {
  return Object.freeze({
    async resumeMarketplaceProviderAction(input: Readonly<{
      paymentId: string; paymentReference: string; payerEmail: string;
      operationId: string; guestCheckoutEvidence: boolean;
    }>) {
      return prepareMarketplacePaystackCustomerAction(input);
    },
    async prepareMarketplacePayment(input: MarketplacePaymentPreparationCommand) {
      const payment = await preparePhase10MarketplacePayment({ ...input });
      if (payment.walletSettled) {
        return Object.freeze({
          paymentReference: payment.publicReference,
          paymentId: payment.id,
          amount: payment.amount,
          currency: "ZAR" as const,
          providerAction: null,
          replayed: payment.replayed,
          walletSettled: true,
        });
      }
      if (isLocalFullFlowAllowed()) {
        return Object.freeze({
          paymentReference: payment.publicReference,
          paymentId: payment.id,
          amount: payment.amount,
          currency: "ZAR" as const,
          providerAction: null,
          replayed: payment.replayed,
          walletSettled: false,
        });
      }
      const providerAction = await prepareMarketplacePaystackCustomerAction({
        paymentId: payment.id,
        paymentReference: payment.publicReference,
        payerEmail: input.payerEmail,
        operationId: input.operationId + ":paystack",
        guestCheckoutEvidence: !input.customerUserId,
      });
      return Object.freeze({
        paymentReference: payment.publicReference, paymentId: payment.id,
        amount: payment.amount, currency: "ZAR" as const, providerAction, replayed: payment.replayed,
        walletSettled: false,
      });
    },
  });
}

/** A READ-ONLY preflight. The canonical Payment service owns its own short
 * serializable PostgreSQL transaction, lock, reservation and payment identity.
 * An outer transaction across the remote Paystack call would be unsafe.
 */
export type MarketplacePaymentPreparationRepository = Readonly<{
  readCheckout(reference: string): Promise<{
    id: string; publicReference: string; customerUserId: string | null;
    guestAccessTokenHash: string | null; status: string; grandTotal: string;
    digitalRequired?: string; cashRequired?: string; currency: string;
    acceptedFingerprint: string | null; reservationActive?: boolean;
    payment?: {
      id: string; publicReference: string; amount: string; currency: string;
      fingerprint?: string | null; status?: string; latestAttemptNumber?: number;
      providerAction?: Readonly<{ type: "REDIRECT_GET"; endpoint: string }> | null;
      metadata?: Record<string, unknown> | null;
    } | null;
  } | null>;
}>;

export async function prepareMarketplaceCheckoutPayment(
  repository: MarketplacePaymentPreparationRepository,
  orchestrator: MarketplacePaymentOrchestrator,
  input: Readonly<{
    checkoutReference: string;
    payerEmail: string;
    operationId: string;
    walletAmount?: string | null;
    testApproval?: { approved: true };
  }>,
): Promise<MarketplacePaymentPreparationResult> {
  const checkout = await repository.readCheckout(input.checkoutReference);
  if (!checkout || !["RESERVED", "PAYMENT_PREPARING", "PAYMENT_PENDING"].includes(checkout.status)
    || !checkout.acceptedFingerprint || checkout.currency !== "ZAR" || checkout.reservationActive === false) {
    throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A reserved accepted checkout is required before payment preparation.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.payerEmail) || input.payerEmail.length > 254) {
    throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A valid payer email is required.");
  }

  const payable = checkout.digitalRequired ?? checkout.grandTotal;
  const assertEffectiveFulfilmentPolicy = async () => {
    if (input.testApproval?.approved || isLocalFullFlowAllowed()) return;
    await assertNewMarketplacePaymentPolicyReady(async () => {
      const now = new Date();
      return prisma.storeOrderOperationalPolicy.findFirst({
        where: {
          status: "ACTIVE", effectiveFrom: { lte: now },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        },
        select: { id: true },
      });
    });
  };
  if (checkout.payment) {
    const meta = (checkout.payment.metadata && typeof checkout.payment.metadata === "object")
      ? (checkout.payment.metadata as Record<string, unknown>)
      : null;
    const walletReserved = typeof meta?.walletAmount === "string" ? meta.walletAmount : "0.00";
    const paymentMatchesEquivalence =
      checkout.payment.amount === payable ||
      (Math.round(Number(checkout.payment.amount) * 100) + Math.round(Number(walletReserved) * 100) === Math.round(Number(payable) * 100));

    if (!paymentMatchesEquivalence || checkout.payment.currency !== "ZAR"
      || (checkout.payment.fingerprint && checkout.payment.fingerprint !== checkout.acceptedFingerprint)) {
      throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Existing payment belongs to different checkout evidence.");
    }
    if (checkout.payment.providerAction || input.testApproval?.approved || isLocalFullFlowAllowed()) {
      return Object.freeze({
        paymentReference: checkout.payment.publicReference, paymentId: checkout.payment.id, amount: payable,
        currency: "ZAR", providerAction: checkout.payment.providerAction ?? null, replayed: true,
      });
    }

    // A crash between canonical payment creation and provider initialization
    // leaves ONE Payment in CREATED with zero attempts. It is safe to reserve
    // a provider attempt only for that same Payment and only while held.
    if (checkout.payment.status === "CREATED" && checkout.payment.latestAttemptNumber === 0
      && checkout.reservationActive === true && orchestrator.resumeMarketplaceProviderAction) {
      assertMarketplaceCheckoutProductionReady("PAYMENT");
      await assertEffectiveFulfilmentPolicy();
      const providerAction = await orchestrator.resumeMarketplaceProviderAction({
        paymentId: checkout.payment.id, paymentReference: checkout.payment.publicReference,
        payerEmail: input.payerEmail, operationId: input.operationId + ":paystack",
        guestCheckoutEvidence: !checkout.customerUserId,
      });
      if (!providerAction) {
        throw new MarketplaceCheckoutError("PAYMENT_PREPARATION_BLOCKED",
          "Payment provider authorization is pending. No further payment has been created.");
      }
      return Object.freeze({
        paymentReference: checkout.payment.publicReference, paymentId: checkout.payment.id,
        amount: payable, currency: "ZAR", providerAction, replayed: true,
      });
    }
    // If a provider attempt is UNKNOWN or in flight, never create another
    // one or return a fake success with a missing Paystack redirect.
    throw new MarketplaceCheckoutError("PAYMENT_PREPARATION_BLOCKED",
      "The existing payment is awaiting provider confirmation. Check payment status before retrying.");
  }

  assertMarketplaceCheckoutProductionReady("PAYMENT", input.testApproval);
  await assertEffectiveFulfilmentPolicy();
  const prepared = await orchestrator.prepareMarketplacePayment({
    checkoutId: checkout.id, checkoutReference: checkout.publicReference,
    customerUserId: checkout.customerUserId, guestAccessTokenHash: checkout.guestAccessTokenHash,
    payerEmail: input.payerEmail, amount: payable, currency: "ZAR",
    commercialFingerprint: checkout.acceptedFingerprint, operationId: input.operationId,
    walletAmount: input.walletAmount,
  });
  const prepWalletAmount = input.walletAmount ?? "0.00";
  const prepMatches = Math.round(Number(prepared.amount) * 100) + Math.round(Number(prepWalletAmount) * 100) === Math.round(Number(payable) * 100);
  if (!prepared.walletSettled && !prepMatches) {
    throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT",
      "Payment provider preparation returned mismatched commercial evidence.");
  }
  // No unconditional checkout or Payment writes after provider I/O!
  // The canonical preparation service atomically linked the payment and
  // marked the held checkout as PAYMENT_PENDING under its own row lock.
  // Repeating those writes here could RESURRECT a concurrently cancelled
  // checkout or overwrite authoritative provider transitions.
  return prepared;
}
