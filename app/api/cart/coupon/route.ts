import { type NextRequest } from "next/server";
import { marketplaceOwner, marketplaceJson, marketplaceError, enforceMarketplaceMutation, readMarketplaceJson, assertExactKeys, stringField } from "@/lib/marketplace-checkout/api-policy";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { applyCouponToCart, removeCouponFromCart } from "@/lib/promotions/cart-coupon.service";

/**
 * Apply coupon code to cart
 */
export async function POST(request: NextRequest) {
  try {
    const mutationFailure = await enforceMarketplaceMutation(request, "cart");
    if (mutationFailure) return mutationFailure;
    const limit = await checkIpRateLimit(request, "marketplace:coupon", { max: 5, windowMs: 15 * 60 * 1000, distributedRequired: true });
    if (!limit.ok) return marketplaceJson({ error: "Too many coupon attempts. Please try again later." }, 429);
    const owner = await marketplaceOwner(request);
    if (!owner) return marketplaceJson({ error: "Unauthorized" }, 401);

    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["code"]);
    assertPromotionsProductionReady("EVALUATION");
    
    const cart = await applyCouponToCart(owner, stringField(body, "code", 80));
    return marketplaceJson(cart);
  } catch (error) {
    return marketplaceError(error);
  }
}

/**
 * Remove coupon from cart
 */
export async function DELETE(request: NextRequest) {
  try {
    const mutationFailure = await enforceMarketplaceMutation(request, "cart");
    if (mutationFailure) return mutationFailure;
    const owner = await marketplaceOwner(request);
    if (!owner) return marketplaceJson({ error: "Unauthorized" }, 401);

    assertPromotionsProductionReady("EVALUATION");
    
    const cart = await removeCouponFromCart(owner);
    return marketplaceJson(cart);
  } catch (error) {
    return marketplaceError(error);
  }
}
