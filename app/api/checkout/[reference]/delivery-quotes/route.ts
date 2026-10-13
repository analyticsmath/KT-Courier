import { type NextRequest } from "next/server";
import { assertExactKeys, enforceMarketplaceMutation, integerField, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { executeMarketplaceDeliveryQuotes } from "@/lib/marketplace-checkout/composition-root";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout"); if (!owner) throw new Error("Checkout access is required.");
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["operationId", "requestHash", "checkoutVersion", "courierServiceKey"]);
    stringField(body, "operationId", 120); stringField(body, "requestHash", 160);
    const { reference } = await context.params;
    return marketplaceJson({ quotes: await executeMarketplaceDeliveryQuotes({ reference, owner, expectedVersion: integerField(body, "checkoutVersion"), courierServiceKey: body.courierServiceKey === undefined ? undefined : stringField(body, "courierServiceKey", 48) }) });
  } catch (error) { return marketplaceError(error); }
}
