import { type NextRequest } from "next/server";
import { getMarketplaceCheckoutForOwner, projectPublicCheckout } from "@/lib/marketplace-checkout/checkout.service";
import { marketplaceError, marketplaceJson, marketplaceOwner } from "@/lib/marketplace-checkout/api-policy";
import { prisma } from "@/lib/db/prisma";
import { listCustomerAddresses } from "@/lib/services/customer-addresses.service";
import { MARKETPLACE_CHECKOUT_COOKIE, MARKETPLACE_ORDER_COOKIE, marketplaceGuestCookieOptions } from "@/lib/marketplace-checkout/tokens";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401);
    const { reference } = await context.params;
    const checkout = await getMarketplaceCheckoutForOwner(reference, owner);
    // The cart and checkout already belong to the authenticated customer.
    // Surface that SAME account's saved addresses, never a guest's or another
    // user's, so a parcel customer can use their address book in the shop.
    const account = owner.type === "CUSTOMER"
      ? await prisma.user.findUnique({
          where: { id: owner.userId },
          select: { name: true, email: true, phone: true },
        })
      : null;
    const savedAddresses = owner.type === "CUSTOMER"
      ? await listCustomerAddresses(owner.userId)
      : [];
    const response = marketplaceJson({
      checkout: projectPublicCheckout(checkout),
      ...(owner.type === "CUSTOMER" ? { account, savedAddresses } : {}),
    });
    if (owner.type === "GUEST" && checkout.status === "COMPLETED") {
      const order = await prisma.marketplaceOrder.findUnique({ where: { checkoutId: checkout.id }, select: { guestConfirmationHash: true, customerUserId: true } });
      const secret = request.cookies.get(MARKETPLACE_CHECKOUT_COOKIE)?.value;
      // The owner lookup above verified this exact capability. Deliver it to
      // the order scope only after canonical finalization bound the same hash.
      if (secret && !order?.customerUserId && order?.guestConfirmationHash === owner.guestTokenHash) {
        response.cookies.set(MARKETPLACE_ORDER_COOKIE, secret, marketplaceGuestCookieOptions);
      }
    }
    return response;
  } catch (error) {
    return marketplaceError(error);
  }
}
