import { type NextRequest } from "next/server";
import { marketplaceOwner, marketplaceJson, marketplaceError } from "@/lib/marketplace-checkout/api-policy";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { evaluateEligiblePromotions } from "@/lib/promotions/cart-coupon.service";

/**
 * Evaluate eligible promotions for current cart
 */
export async function POST(request: NextRequest) {
  try {
    const owner = await marketplaceOwner(request);
    if (!owner) return marketplaceJson({ error: "Unauthorized" }, 401);

    assertPromotionsProductionReady("EVALUATION");
    
    const evaluation = await evaluateEligiblePromotions(owner);
    return marketplaceJson(evaluation);
  } catch (error) {
    return marketplaceError(error);
  }
}
