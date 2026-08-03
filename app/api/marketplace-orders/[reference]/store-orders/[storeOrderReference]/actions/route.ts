import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MARKETPLACE_ORDER_COOKIE } from "@/lib/marketplace-checkout/tokens";
import { exactKeys, enforceStoreOrderMutation, storeOrderBody, storeOrderError, storeOrderJson, text } from "@/lib/store-orders/api-policy";
import { decideStoreOrderSubstitution, requestMarketplaceStoreOrderCancellation, updateStoreOrderSubstitutionPreference } from "@/lib/store-orders/store-order.service";

const hash = (action: string, body: Record<string, unknown>) => createHash("sha256").update(`${action}:${JSON.stringify(body)}`).digest("hex");

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string; storeOrderReference: string }> }) {
  try {
    const blocked = await enforceStoreOrderMutation(request, "customer"); if (blocked) return blocked;
    const { reference, storeOrderReference } = await context.params; const user = await getCurrentUser();
    const customerUserId = user?.role === "CUSTOMER" ? user.id : undefined; const guestSecret = customerUserId ? undefined : request.cookies.get(MARKETPLACE_ORDER_COOKIE)?.value;
    if (!customerUserId && !guestSecret) return storeOrderJson({ error: "Customer order ownership is required." }, 401);
    const body = await storeOrderBody(request); const action = text(body, "action", 3, 40); const operationId = text(body, "operationId", 12, 160); const requestHash = hash(action, body);
    let result: unknown;
    if (action === "substitution-preference") { exactKeys(body, ["action", "operationId", "orderLineId", "preference"]); const preference = text(body, "preference", 3, 40); if (!["REFUND_IF_UNAVAILABLE", "NO_SUBSTITUTION", "CONTACT_ME", "PREAPPROVED_CHOICES_ONLY"].includes(preference)) return storeOrderJson({ error: "Invalid substitution preference." }, 422); result = await updateStoreOrderSubstitutionPreference({ storeOrderReference, orderLineId: text(body, "orderLineId", 5, 128), customerUserId, guestSecret, preference: preference as "REFUND_IF_UNAVAILABLE" | "NO_SUBSTITUTION" | "CONTACT_ME" | "PREAPPROVED_CHOICES_ONLY", operationId, requestHash }); }
    else if (action === "decide-substitution") { exactKeys(body, ["action", "operationId", "proposalReference", "decision"]); const decision = text(body, "decision", 3, 30); if (decision !== "APPROVE" && decision !== "REJECT_AND_REFUND") return storeOrderJson({ error: "Invalid substitution decision." }, 422); result = await decideStoreOrderSubstitution({ storeOrderReference, proposalReference: text(body, "proposalReference", 5, 128), customerUserId, guestSecret, decision, operationId, requestHash }); }
    else if (action === "request-cancellation") { exactKeys(body, ["action", "operationId", "reasonCode", "note"]); result = await requestMarketplaceStoreOrderCancellation({ storeOrderReference, requesterType: "CUSTOMER", requesterUserId: customerUserId, guestSecret, reasonCode: text(body, "reasonCode", 3, 80), note: typeof body.note === "string" ? body.note : undefined, operationId, requestHash }); }
    else return storeOrderJson({ error: "Unsupported customer store-order action." }, 422);
    return storeOrderJson({ marketplaceOrderReference: reference, result });
  } catch (error) { return storeOrderError(error); }
}
