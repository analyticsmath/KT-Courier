import type { NextRequest } from "next/server";
import { assertExactKeys, enforceMarketplaceMutation, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { getGuestContactVerification, requestGuestContactVerification, verifyGuestContact } from "@/lib/marketplace-checkout/guest-contact-verification.service";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401);
    const { reference } = await context.params;
    return marketplaceJson(await getGuestContactVerification({ reference, owner }));
  } catch (error) { return marketplaceError(error); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401);
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["operationId"]);
    const { reference } = await context.params;
    return marketplaceJson(await requestGuestContactVerification({ reference, owner, operationId: stringField(body, "operationId", 120) }));
  } catch (error) { return marketplaceError(error); }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401);
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["verificationReference", "code"]);
    const { reference } = await context.params;
    return marketplaceJson(await verifyGuestContact({ reference, owner, verificationReference: stringField(body, "verificationReference", 80), code: stringField(body, "code", 6) }));
  } catch (error) { return marketplaceError(error); }
}
