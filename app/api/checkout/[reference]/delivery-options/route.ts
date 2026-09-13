import { type NextRequest } from "next/server";
import { assertExactKeys, enforceMarketplaceMutation, integerField, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { selectMarketplaceCheckoutDeliveryOptions } from "@/lib/marketplace-checkout/delivery-selection.service";
import { projectPublicCheckout } from "@/lib/marketplace-checkout/checkout.service";

export async function PUT(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401);
    const body = await readMarketplaceJson(request);
    if ("selections" in body) {
      assertExactKeys(body, ["operationId", "requestHash", "checkoutVersion", "selections"]);
    } else {
      assertExactKeys(body, ["operationId", "requestHash", "checkoutVersion"]);
    }
    const { reference } = await context.params;
    const checkout = await selectMarketplaceCheckoutDeliveryOptions({
      reference,
      owner,
      operation: {
        operationId: stringField(body, "operationId", 120),
        requestHash: stringField(body, "requestHash", 160),
        expectedVersion: integerField(body, "checkoutVersion"),
      },
      selections: Array.isArray(body.selections) ? body.selections : undefined,
    });
    return marketplaceJson({ checkout: projectPublicCheckout(checkout) });
  } catch (error) {
    return marketplaceError(error);
  }
}

export const POST = PUT;
