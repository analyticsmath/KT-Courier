/* eslint-disable @typescript-eslint/no-explicit-any -- serialised database output is deliberately whitelisted into a public DTO. */
import { type NextRequest } from "next/server";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { createOrResolveCart } from "@/lib/marketplace-checkout/cart-mutation.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import { createMarketplaceGuestSecret, hashMarketplaceGuestSecret, marketplaceGuestCookieOptions, MARKETPLACE_CART_COOKIE } from "@/lib/marketplace-checkout/tokens";
import { marketplaceError, marketplaceJson, marketplaceOwner } from "@/lib/marketplace-checkout/api-policy";

function publicCart(cart: any) { const groups = new Map<string, any[]>(); for (const line of cart.lines ?? []) groups.set(line.storeId, [...(groups.get(line.storeId) ?? []), line]); return { reference: cart.publicReference, status: cart.status, currency: "ZAR", version: cart.version, storeGroups: [...groups.entries()].map(([storeReference, lines]) => ({ storeReference, fulfilmentMode: lines[0]?.selection?.fulfilmentMode, lines: lines.map((line) => ({ reference: line.publicReference, productReference: line.selection.productReference, variantReference: line.selection.variantReference, offerReference: line.selection.offerReference, quantity: line.quantity, modifiers: line.selection.modifiers })) })) }; }

export async function GET(request: NextRequest) {
  try {
    let owner = await marketplaceOwner(request); let guestSecret: string | undefined;
    if (!owner) { guestSecret = createMarketplaceGuestSecret(); owner = { type: "GUEST", guestTokenHash: hashMarketplaceGuestSecret(guestSecret) }; }
    const repository = createPrismaMarketplaceCartRepository();
    const cart = await createOrResolveCart(repository, owner as CartOwner, () => repository.create(owner as CartOwner));
    const response = marketplaceJson({ cart: publicCart(cart) });
    if (guestSecret) response.cookies.set(MARKETPLACE_CART_COOKIE, guestSecret, marketplaceGuestCookieOptions);
    return response;
  } catch (error) { return marketplaceError(error); }
}
