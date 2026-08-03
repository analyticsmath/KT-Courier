import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { verifyMarketplaceGuestSecret } from "@/lib/marketplace-checkout/tokens";

export type MarketplaceConfirmationRepository = Readonly<{
  findOrder(reference: string): Promise<{ publicReference: string; customerUserId: string | null; guestConfirmationHash: string | null; status: string; paymentStatus: string; placedAt: Date; currency: string; merchandiseSubtotal: string; modifierSubtotal: string; deliveryFeeTotal: string; grandTotal: string; storeGroups: readonly unknown[] } | null>;
}>;

export async function getMarketplaceOrderConfirmation(repository: MarketplaceConfirmationRepository, input: Readonly<{ publicReference: string; customerUserId?: string | null; guestSecret?: string | null }>) {
  const order = await repository.findOrder(input.publicReference);
  if (!order || (order.customerUserId ? order.customerUserId !== input.customerUserId : !verifyMarketplaceGuestSecret(input.guestSecret ?? undefined, order.guestConfirmationHash))) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Order confirmation is unavailable.");
  return Object.freeze({ publicReference: order.publicReference, status: order.status, paymentStatus: order.paymentStatus, placedAt: order.placedAt, currency: order.currency, totals: { merchandiseSubtotal: order.merchandiseSubtotal, modifierSubtotal: order.modifierSubtotal, deliveryFeeTotal: order.deliveryFeeTotal, grandTotal: order.grandTotal }, storeGroups: order.storeGroups });
}
