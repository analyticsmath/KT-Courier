import { type NextRequest } from "next/server";
import { assertExactKeys, enforceMarketplaceMutation, integerField, marketplaceError, marketplaceJson, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { executeMarketplaceCheckoutAcknowledgement } from "@/lib/marketplace-checkout/composition-root";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "checkout");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout"); if (!owner) throw new Error("Checkout access is required.");
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["operationId", "requestHash", "checkoutVersion", "reviewVersion", "commercialFingerprint", "acknowledgedTotalReference", "termsVersion", "privacyVersion", "refundPolicyReferences"]);
    if (!Array.isArray(body.refundPolicyReferences) || !body.refundPolicyReferences.length || body.refundPolicyReferences.some((value) => typeof value !== "string" || !value.trim())) throw new Error("Invalid acknowledgement.");
    const operationId = stringField(body, "operationId", 120); const requestHash = stringField(body, "requestHash", 160);
    const { reference } = await context.params;
    return marketplaceJson(await executeMarketplaceCheckoutAcknowledgement({ reference, owner, operationId, requestHash, expectedVersion: integerField(body, "checkoutVersion"), reviewVersion: integerField(body, "reviewVersion"), commercialFingerprint: stringField(body, "commercialFingerprint", 160), acknowledgedTotalReference: stringField(body, "acknowledgedTotalReference", 32), termsVersion: stringField(body, "termsVersion", 120), privacyVersion: stringField(body, "privacyVersion", 120), refundPolicyReferences: body.refundPolicyReferences as string[] }));
  } catch (error) { return marketplaceError(error); }
}
