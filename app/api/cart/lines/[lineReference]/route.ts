import { type NextRequest } from "next/server";
import { resolveMarketplaceCartLine, type CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { replaceCartLineModifiers, updateCartLineQuantity } from "@/lib/marketplace-checkout/cart-mutation.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import { assertExactKeys, enforceMarketplaceMutation, integerField, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { projectHydratedCart } from "@/lib/marketplace-checkout/cart-projection";
import { removeCartLine } from "@/lib/marketplace-checkout/cart-mutation.service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ lineReference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "cart");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request);
    if (!owner) return marketplaceJson({ error: "Cart access is required." }, 401);
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["cartReference", "cartVersion", "operationId", "requestHash", "quantity", "modifiers"]);
    const repository = createPrismaMarketplaceCartRepository();
    const cart = await repository.lockCartByOwner(owner as CartOwner);
    if (!cart || cart.publicReference !== stringField(body, "cartReference", 160)) return marketplaceJson({ error: "Cart is unavailable." }, 404);
    const { lineReference } = await context.params;
    const mutation = { operationId: stringField(body, "operationId", 160), requestHash: stringField(body, "requestHash", 160), expectedVersion: integerField(body, "cartVersion") };
    if (body.quantity !== undefined) {
      const result = await updateCartLineQuantity(repository, {
        cartId: cart.id,
        lineReference,
        owner: owner as CartOwner,
        mutation,
        quantity: integerField(body, "quantity"),
        revalidate: async (line, quantity) => resolveMarketplaceCartLine({
          offerReference: line.selection.offerReference,
          variantReference: line.selection.variantReference,
          quantity,
          modifiers: line.selection.modifiers.map(({ groupReference, optionReference, quantity: modifierQuantity }) => ({ groupReference, optionReference, quantity: modifierQuantity })),
        }),
      });
      const hydrated = await projectHydratedCart(result.cart);
      return marketplaceJson({ cart: { ...result, cart: hydrated, ...hydrated } });
    }
    if (!Array.isArray(body.modifiers)) throw new Error("Invalid modifiers.");
    const modifiers = body.modifiers.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid modifiers.");
      const item = value as Record<string, unknown>;
      assertExactKeys(item, ["groupReference", "optionReference", "quantity"]);
      return { groupReference: stringField(item, "groupReference", 160), optionReference: stringField(item, "optionReference", 160), quantity: integerField(item, "quantity") };
    });
    const result = await replaceCartLineModifiers(repository, {
      cartId: cart.id,
      lineReference,
      owner: owner as CartOwner,
      mutation,
      modifiers,
      revalidate: async (line, currentModifiers) => resolveMarketplaceCartLine({
        offerReference: line.selection.offerReference,
        variantReference: line.selection.variantReference,
        quantity: line.quantity,
        modifiers: currentModifiers,
      }),
    });
    const hydrated = await projectHydratedCart(result.cart);
    return marketplaceJson({ cart: { ...result, cart: hydrated, ...hydrated } });
  } catch (error) { return marketplaceError(error); }
}

export const PUT = PATCH;

export async function DELETE(request: NextRequest, context: { params: Promise<{ lineReference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "cart");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request);
    if (!owner) return marketplaceJson({ error: "Cart access is required." }, 401);
    const body = (await readMarketplaceJson(request).catch(() => ({}))) as Record<string, unknown>;
    const repository = createPrismaMarketplaceCartRepository();
    const cart = await repository.lockCartByOwner(owner as CartOwner);
    if (!cart) return marketplaceJson({ error: "Cart is unavailable." }, 404);
    const { lineReference } = await context.params;
    const opId = typeof body.operationId === "string" ? body.operationId : `del-${crypto.randomUUID()}`;
    const hash = typeof body.requestHash === "string" ? body.requestHash : `hash-${opId}`;
    const version = typeof body.cartVersion === "number" ? body.cartVersion : cart.version;
    const result = await removeCartLine(repository, {
      cartId: cart.id,
      lineReference,
      owner: owner as CartOwner,
      mutation: { operationId: opId, requestHash: hash, expectedVersion: version },
    });
    const hydrated = await projectHydratedCart(result.cart);
    return marketplaceJson({ cart: { ...result, cart: hydrated, ...hydrated } });
  } catch (error) { return marketplaceError(error); }
}
