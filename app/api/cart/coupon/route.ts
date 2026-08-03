import { type NextRequest, NextResponse } from "next/server";
import { marketplaceOwner, marketplaceJson, marketplaceError } from "@/lib/marketplace-checkout/api-policy";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { applyCouponToCart, removeCouponFromCart } from "@/lib/promotions/cart-coupon.service";

/**
 * Apply coupon code to cart
 */
export async function POST(request: NextRequest) {
  try {
    const owner = await marketplaceOwner(request);
    if (!owner) return marketplaceJson({ error: "Unauthorized" }, 401);

    const body = await request.json();
    assertPromotionsProductionReady("EVALUATION");
    
    const cart = await applyCouponToCart(owner, body.code);
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
    const owner = await marketplaceOwner(request);
    if (!owner) return marketplaceJson({ error: "Unauthorized" }, 401);

    assertPromotionsProductionReady("EVALUATION");
    
    const cart = await removeCouponFromCart(owner);
    return marketplaceJson(cart);
  } catch (error) {
    return marketplaceError(error);
  }
}
