import type { NextRequest } from "next/server";
import { assertExactKeys, enforceMarketplaceMutation, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson } from "@/lib/marketplace-checkout/api-policy";
import { setGuestNotificationPreference } from "@/lib/marketplace-checkout/guest-contact-verification.service";

export async function PUT(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401);
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["enabled"]);
    if (typeof body.enabled !== "boolean") return marketplaceJson({ error: "Select whether email updates are enabled." }, 422);
    const { reference } = await context.params;
    return marketplaceJson(await setGuestNotificationPreference({ reference, owner, enabled: body.enabled }));
  } catch (error) { return marketplaceError(error); }
}
