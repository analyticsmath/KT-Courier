import { type NextRequest } from "next/server";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { createOrResolveCart } from "@/lib/marketplace-checkout/cart-mutation.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import { createMarketplaceGuestSecret, hashMarketplaceGuestSecret, marketplaceGuestCookieOptions, MARKETPLACE_CART_COOKIE } from "@/lib/marketplace-checkout/tokens";
import { marketplaceError, marketplaceJson, marketplaceOwner } from "@/lib/marketplace-checkout/api-policy";
import { projectHydratedCart } from "@/lib/marketplace-checkout/cart-projection";

export async function GET(request: NextRequest) {
  try {
    let owner = await marketplaceOwner(request); let guestSecret: string | undefined;
    if (!owner) { guestSecret = createMarketplaceGuestSecret(); owner = { type: "GUEST", guestTokenHash: hashMarketplaceGuestSecret(guestSecret) }; }
    const repository = createPrismaMarketplaceCartRepository();
    const cart = await createOrResolveCart(repository, owner as CartOwner, () => repository.create(owner as CartOwner));
    const response = marketplaceJson({ cart: await projectHydratedCart(cart) });
    if (guestSecret) response.cookies.set(MARKETPLACE_CART_COOKIE, guestSecret, marketplaceGuestCookieOptions);
    return response;
  } catch (error) { return marketplaceError(error); }
}
