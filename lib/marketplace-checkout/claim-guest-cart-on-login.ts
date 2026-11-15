import { createHash, randomUUID } from "node:crypto";
import { resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";
import { claimGuestCart, createOrResolveCart } from "@/lib/marketplace-checkout/cart-mutation.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import { hashMarketplaceGuestSecret, MARKETPLACE_CART_COOKIE } from "@/lib/marketplace-checkout/tokens";

type AuthCookieStore = {
  get(name: string): { value: string } | undefined;
  delete(name: string): void;
};

/**
 * Merges any active anonymous guest marketplace cart into an authenticated
 * CUSTOMER cart on sign-in or email verification without deleting existing
 * customer items, then clears the guest cart cookie.
 */
export async function claimGuestCartIfPresentOnCustomerAuth(
  cookieStore: AuthCookieStore,
  user: { id: string; role: string },
): Promise<void> {
  if (user.role !== "CUSTOMER") return;
  const guestSecret = cookieStore.get(MARKETPLACE_CART_COOKIE)?.value;
  if (!guestSecret) return;
  try {
    const repository = createPrismaMarketplaceCartRepository();
    const guestOwner = {
      type: "GUEST" as const,
      guestTokenHash: hashMarketplaceGuestSecret(guestSecret),
    };
    const guestCart = await repository.findCartByOwner(guestOwner);
    if (guestCart && guestCart.status === "ACTIVE" && guestCart.lines.length > 0) {
      const customerOwner = { type: "CUSTOMER" as const, userId: user.id };
      await createOrResolveCart(repository, customerOwner, () => repository.create(customerOwner));
      const operationId = `auth-claim:${user.id}:${guestCart.id}:${guestCart.version}:${randomUUID().slice(0, 8)}`;
      const requestHash = createHash("sha256").update(operationId).digest("hex");
      await claimGuestCart(repository, {
        guestOwner,
        customerOwner,
        mutation: {
          operationId,
          requestHash,
          expectedVersion: guestCart.version,
        },
        revalidate: (line, quantity) =>
          resolveMarketplaceCartLine({
            offerReference: line.selection.offerReference,
            variantReference: line.selection.variantReference,
            quantity: quantity ?? line.quantity,
            modifiers: line.selection.modifiers.map((modifier) => ({
              groupReference: modifier.groupReference,
              optionReference: modifier.optionReference,
              quantity: modifier.quantity,
            })),
          }),
      });
    }
    cookieStore.delete(MARKETPLACE_CART_COOKIE);
  } catch {
    // Non-fatal during authentication: /api/cart/claim remains available if items need manual resolution.
  }
}
