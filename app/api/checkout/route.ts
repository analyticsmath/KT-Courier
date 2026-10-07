import { type NextRequest } from "next/server";
import { createMarketplaceCheckout, projectPublicCheckout } from "@/lib/marketplace-checkout/checkout.service";
import { assertExactKeys, enforceMarketplaceMutation, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { marketplaceGuestCookieOptions, MARKETPLACE_CART_COOKIE, MARKETPLACE_CHECKOUT_COOKIE } from "@/lib/marketplace-checkout/tokens";

export async function POST(request: NextRequest) {
  const limited = await enforceMarketplaceMutation(request, "checkout"); if (limited) return limited;
  try {
    const body = await readMarketplaceJson(request); assertExactKeys(body, ["cartReference"]);
    const owner = await marketplaceOwner(request); let guestSecret: string | undefined;
    if (!owner) return marketplaceJson({ error: "Cart access is required." }, 401);
    const checkout = await createMarketplaceCheckout({ cartReference: stringField(body, "cartReference", 160), owner });
    if (owner.type === "GUEST") { guestSecret = request.cookies.get(MARKETPLACE_CART_COOKIE)?.value; }
    const response = marketplaceJson({ checkout: projectPublicCheckout(checkout) }, 201);
    if (guestSecret) response.cookies.set(MARKETPLACE_CHECKOUT_COOKIE, guestSecret, marketplaceGuestCookieOptions);
    return response;
  } catch (error) { return marketplaceError(error); }
}
