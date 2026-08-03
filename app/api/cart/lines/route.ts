import { type NextRequest } from "next/server";
import { resolveMarketplaceCartLine, type CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { addCartLine, createOrResolveCart } from "@/lib/marketplace-checkout/cart-mutation.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import { assertExactKeys, enforceMarketplaceMutation, integerField, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { createMarketplaceGuestSecret, hashMarketplaceGuestSecret, marketplaceGuestCookieOptions, MARKETPLACE_CART_COOKIE } from "@/lib/marketplace-checkout/tokens";

export async function POST(request: NextRequest) {
  const limited = await enforceMarketplaceMutation(request, "cart"); if (limited) return limited;
  try {
    const body = await readMarketplaceJson(request); assertExactKeys(body, ["offerReference", "variantReference", "quantity", "modifiers", "operationId", "requestHash", "cartVersion"]);
    if (!Array.isArray(body.modifiers) || body.modifiers.length > 30) throw new Error("Invalid modifiers.");
    const modifiers = body.modifiers.map((value) => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid modifiers."); const item = value as Record<string, unknown>; assertExactKeys(item, ["groupReference", "optionReference", "quantity"]); return { groupReference: stringField(item, "groupReference", 160), optionReference: stringField(item, "optionReference", 160), quantity: integerField(item, "quantity") }; });
    let owner = await marketplaceOwner(request); let guestSecret: string | undefined;
    if (!owner) { guestSecret = createMarketplaceGuestSecret(); owner = { type: "GUEST", guestTokenHash: hashMarketplaceGuestSecret(guestSecret) }; }
    const repository = createPrismaMarketplaceCartRepository();
    const cart = await createOrResolveCart(repository, owner as CartOwner, () => repository.create(owner as CartOwner));
    const selection = await resolveMarketplaceCartLine({ offerReference: stringField(body, "offerReference", 160), variantReference: stringField(body, "variantReference", 160), quantity: integerField(body, "quantity"), modifiers });
    const result = await addCartLine(repository, { cartId: cart.id, owner: owner as CartOwner, mutation: { operationId: stringField(body, "operationId", 160), requestHash: stringField(body, "requestHash", 160), expectedVersion: integerField(body, "cartVersion") }, selection });
    const response = marketplaceJson({ cart: result }, 201); if (guestSecret) response.cookies.set(MARKETPLACE_CART_COOKIE, guestSecret, marketplaceGuestCookieOptions); return response;
  } catch (error) { return marketplaceError(error); }
}
