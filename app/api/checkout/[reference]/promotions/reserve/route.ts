import { type NextRequest } from "next/server";
import { marketplaceOwner, marketplaceJson, marketplaceError, enforceMarketplaceMutation, readMarketplaceJson, assertExactKeys, stringField } from "@/lib/marketplace-checkout/api-policy";
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
    const mutationFailure = await enforceMarketplaceMutation(request, "reservation");
    if (mutationFailure) return mutationFailure;
    const params = await context.params;
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Unauthorized" }, 401);

    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["operationId", "requestHash"]);
    assertPromotionsProductionReady("RESERVATION");
    
    const evidence = await reservePromotions({
      owner,
      checkoutReference: params.reference,
      operationId: stringField(body, "operationId", 120),
    });
    return marketplaceJson(evidence);
  } catch (error) {
    return marketplaceError(error);
  }
}
