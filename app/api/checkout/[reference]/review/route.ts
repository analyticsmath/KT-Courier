import { type NextRequest } from "next/server";
import { assertExactKeys, enforceMarketplaceMutation, integerField, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { executeMarketplaceCheckoutReview } from "@/lib/marketplace-checkout/composition-root";
import { resolveMarketplaceLegalEvidence } from "@/lib/marketplace-checkout/legal-evidence";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout"); if (!owner) throw new Error("Checkout access is required.");
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["operationId", "requestHash", "checkoutVersion"]);
    const operationId = stringField(body, "operationId", 120); const requestHash = stringField(body, "requestHash", 160);
    const { reference } = await context.params;
    const review = await executeMarketplaceCheckoutReview({ reference, owner, operationId, requestHash, expectedVersion: integerField(body, "checkoutVersion") });
    return marketplaceJson({
      status: review.status, reviewVersion: review.reviewVersion, commercialFingerprint: review.commercialFingerprint,
      merchandiseSubtotal: review.merchandiseSubtotal, modifierSubtotal: review.modifierSubtotal,
      deliveryFeeTotal: review.deliveryFeeTotal, promotionDiscount: review.promotionDiscount, grandTotal: review.grandTotal,
      changes: review.changes, quotes: review.quotes, legalEvidence: await resolveMarketplaceLegalEvidence(),
    });
  } catch (error) { return marketplaceError(error); }
}
