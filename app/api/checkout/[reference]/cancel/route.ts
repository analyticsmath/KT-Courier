import { type NextRequest } from "next/server";
import { assertExactKeys, enforceMarketplaceMutation, marketplaceError, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { cancelMarketplaceCheckout } from "@/lib/marketplace-checkout/checkout.service";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout"); if (!owner) throw new Error("Checkout access is required.");
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["operationId", "requestHash"]);
    const { reference } = await context.params;
    const result = await cancelMarketplaceCheckout({ reference, owner, operationId: stringField(body, "operationId", 160) });
    return Response.json(result);
  } catch (error) { return marketplaceError(error); }
}
