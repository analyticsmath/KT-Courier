import { type NextRequest } from "next/server";
import { marketplaceOwner, marketplaceJson, marketplaceError } from "@/lib/marketplace-checkout/api-policy";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { reservePromotions } from "@/lib/promotions/checkout-promotions.service";

/**
 * Reserve promotions for checkout review
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  try {
    const params = await context.params;
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Unauthorized" }, 401);

    const body = await request.json();
    assertPromotionsProductionReady("RESERVATION");
    
    const evidence = await reservePromotions({
      owner,
      checkoutReference: params.reference,
      operationId: body.operationId,
      requestHash: body.requestHash
    });
    return marketplaceJson(evidence);
  } catch (error) {
    return marketplaceError(error);
  }
}
