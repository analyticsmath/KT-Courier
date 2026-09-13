import { type NextRequest } from "next/server";
import { getMarketplaceCheckoutForOwner, projectPublicCheckout } from "@/lib/marketplace-checkout/checkout.service";
import { marketplaceError, marketplaceJson, marketplaceOwner } from "@/lib/marketplace-checkout/api-policy";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401);
    const { reference } = await context.params;
    const checkout = await getMarketplaceCheckoutForOwner(reference, owner);
    return marketplaceJson({ checkout: projectPublicCheckout(checkout) });
  } catch (error) {
    return marketplaceError(error);
  }
}
