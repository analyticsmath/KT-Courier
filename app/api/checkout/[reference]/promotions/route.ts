import { type NextRequest } from "next/server";
import { marketplaceOwner, marketplaceJson, marketplaceError } from "@/lib/marketplace-checkout/api-policy";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { viewFrozenPromotions } from "@/lib/promotions/checkout-promotions.service";

/**
 * View frozen promotion evidence for a checkout
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  try {
    const params = await context.params;
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Unauthorized" }, 401);

    assertPromotionsProductionReady("EVALUATION");
    
    const evidence = await viewFrozenPromotions(owner, params.reference);
    return marketplaceJson(evidence);
  } catch (error) {
    return marketplaceError(error);
  }
}
