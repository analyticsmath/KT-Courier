import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { reservationReleaseAllowed } from "@/lib/marketplace-checkout/policy";

export type MarketplaceCheckoutCancellationRepository = Readonly<{
  transaction<T>(work: () => Promise<T>): Promise<T>;
  lockCheckout(reference: string): Promise<{ id: string; status: string; paymentStatus: string | null; paymentOutcomeKnown: boolean; reservationId: string | null } | null>;
  releaseReservation(reservationId: string, operationId: string, reason: "CHECKOUT_CANCELLED" | "PAYMENT_DEFINITELY_FAILED"): Promise<void>;
  cancelCheckout(checkoutId: string): Promise<void>;
  openUncertainPaymentCase(checkoutId: string, operationId: string): Promise<void>;
}>;

export async function cancelMarketplaceCheckout(repository: MarketplaceCheckoutCancellationRepository, input: Readonly<{ checkoutReference: string; operationId: string }>): Promise<Readonly<{ status: "CANCELLED" | "PAYMENT_PENDING"; authoritative: boolean }>> {
  return repository.transaction(async () => {
    const checkout = await repository.lockCheckout(input.checkoutReference);
    if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
    if (["PAYMENT_PENDING", "PAYMENT_CONFIRMED", "COMPLETING", "COMPLETED"].includes(checkout.status) || !reservationReleaseAllowed({ reservationStatus: checkout.reservationId ? "ACTIVE" : "RELEASED", paymentStatus: checkout.paymentStatus, paymentOutcomeKnown: checkout.paymentOutcomeKnown })) {
      await repository.openUncertainPaymentCase(checkout.id, input.operationId);
      return Object.freeze({ status: "PAYMENT_PENDING" as const, authoritative: false });
    }
    if (checkout.reservationId) await repository.releaseReservation(checkout.reservationId, input.operationId, checkout.paymentStatus === "FAILED" ? "PAYMENT_DEFINITELY_FAILED" : "CHECKOUT_CANCELLED");
    await repository.cancelCheckout(checkout.id);
    return Object.freeze({ status: "CANCELLED" as const, authoritative: true });
  });
}
