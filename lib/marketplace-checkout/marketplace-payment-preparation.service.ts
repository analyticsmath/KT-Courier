import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";
import { prepareMarketplacePayment as preparePhase10MarketplacePayment } from "@/lib/services/payment-preparation.service";
import { prepareMarketplacePayfastCustomerAction } from "@/lib/marketplace-checkout/marketplace-payfast-checkout.service";

export type MarketplacePaymentPreparationResult = Readonly<{ paymentReference: string; paymentId: string; amount: string; currency: "ZAR"; providerAction: Readonly<{ type: "FORM_POST"; endpoint: string; fields: Readonly<Record<string, string>> }> | null; replayed: boolean }>;
export interface MarketplacePaymentOrchestrator {
  prepareMarketplacePayment(input: Readonly<{ checkoutId: string; checkoutReference: string; customerUserId: string | null; guestAccessTokenHash: string | null; payerEmail: string; amount: string; currency: "ZAR"; commercialFingerprint: string; operationId: string }>): Promise<MarketplacePaymentPreparationResult>;
}

/** Phase 10 → 11 adapter; Phase 20 only maps trusted checkout evidence. */
export function createPhase10And11MarketplacePaymentOrchestrator(): MarketplacePaymentOrchestrator {
  return Object.freeze({
    async prepareMarketplacePayment(input: any) {
      const payment: any = await preparePhase10MarketplacePayment({ ...input });
      const providerAction = await prepareMarketplacePayfastCustomerAction({ paymentId: payment.id, paymentReference: payment.publicReference, payerEmail: input.payerEmail, operationId: `${input.operationId}:payfast`, guestCheckoutEvidence: !input.customerUserId });
      return Object.freeze({ paymentReference: payment.publicReference, paymentId: payment.id, amount: payment.amount, currency: "ZAR", providerAction, replayed: payment.replayed });
    },
  });
}
export type MarketplacePaymentPreparationRepository = Readonly<{
  transaction<T>(work: () => Promise<T>): Promise<T>;
  lockCheckout(reference: string): Promise<{ id: string; publicReference: string; customerUserId: string | null; guestAccessTokenHash: string | null; status: string; grandTotal: string; currency: string; acceptedFingerprint: string | null; reservationActive?: boolean; payment?: { id: string; publicReference: string; amount: string; currency: string; fingerprint?: string | null } | null } | null>;
  linkPayment(checkoutId: string, paymentId: string): Promise<void>;
  transitionCheckout(checkoutId: string, status: "PAYMENT_PENDING"): Promise<void>;
}>;

export async function prepareMarketplaceCheckoutPayment(repository: MarketplacePaymentPreparationRepository, orchestrator: MarketplacePaymentOrchestrator, input: Readonly<{ checkoutReference: string; payerEmail: string; operationId: string; testApproval?: { approved: true } }>): Promise<MarketplacePaymentPreparationResult> {
  return repository.transaction(async () => {
    const checkout = await repository.lockCheckout(input.checkoutReference);
    if (!checkout || !["RESERVED", "PAYMENT_PREPARING", "PAYMENT_PENDING"].includes(checkout.status) || !checkout.acceptedFingerprint || checkout.currency !== "ZAR" || checkout.reservationActive === false) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A reserved accepted checkout is required before payment preparation.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.payerEmail) || input.payerEmail.length > 254) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A valid payer email is required.");
    if (checkout.payment) {
      if (checkout.payment.amount !== checkout.grandTotal || checkout.payment.currency !== "ZAR" || (checkout.payment.fingerprint && checkout.payment.fingerprint !== checkout.acceptedFingerprint)) throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Existing payment belongs to different checkout evidence.");
      return Object.freeze({ paymentReference: checkout.payment.publicReference, paymentId: checkout.payment.id, amount: checkout.grandTotal, currency: "ZAR", providerAction: null, replayed: true });
    }
    // The real checkout, reservation, payer binding, and replay surfaces have
    // been resolved before the source validation gate blocks external execution.
    assertMarketplaceCheckoutProductionReady("PAYMENT", input.testApproval);
    const prepared = await orchestrator.prepareMarketplacePayment({ checkoutId: checkout.id, checkoutReference: checkout.publicReference, customerUserId: checkout.customerUserId, guestAccessTokenHash: checkout.guestAccessTokenHash, payerEmail: input.payerEmail, amount: checkout.grandTotal, currency: "ZAR", commercialFingerprint: checkout.acceptedFingerprint, operationId: input.operationId });
    if (prepared.amount !== checkout.grandTotal || prepared.currency !== "ZAR") throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Payment provider preparation returned mismatched commercial evidence.");
    await repository.linkPayment(checkout.id, prepared.paymentId); await repository.transitionCheckout(checkout.id, "PAYMENT_PENDING");
    return prepared;
  });
}
