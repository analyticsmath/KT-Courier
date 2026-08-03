import { type NextRequest } from "next/server";
import { assertExactKeys, enforceMarketplaceMutation, integerField, marketplaceError, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { resolveAndAssertMarketplaceCheckoutOperation } from "@/lib/marketplace-checkout/composition-root";

export async function PUT(request: NextRequest) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    if (!await marketplaceOwner(request, "checkout")) throw new Error("Checkout access is required.");
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["operationId", "requestHash", "checkoutVersion"]);
    stringField(body, "operationId", 120); stringField(body, "requestHash", 160); integerField(body, "checkoutVersion");
    resolveAndAssertMarketplaceCheckoutOperation("DELIVERY_QUOTE");
  } catch (error) { return marketplaceError(error); }
}
