import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { exactKeys, enforceStoreOrderMutation, integer, storeOrderBody, storeOrderError, storeOrderJson, text } from "@/lib/store-orders/api-policy";
import { acceptMarketplaceStoreOrder, beginStoreOrderReview, confirmStoreOrderLineAvailability, generateStoreOrderPickupChallenge, markStoreOrderReadyForHandoff, proposeStoreOrderSubstitution, rejectMarketplaceStoreOrder, startStoreOrderPreparation, updateStoreOrderPreparationTime } from "@/lib/store-orders/store-order.service";

const hash = (action: string, body: Record<string, unknown>) => createHash("sha256").update(`${action}:${JSON.stringify(body)}`).digest("hex");

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const blocked = await enforceStoreOrderMutation(request, "store"); if (blocked) return blocked;
    const actor = await getCurrentUser(); if (!actor) return storeOrderJson({ error: "Authentication is required." }, 401);
    const { reference } = await context.params; const body = await storeOrderBody(request); const action = text(body, "action", 3, 40); const operationId = text(body, "operationId", 12, 160);
    const requestHash = hash(action, body);
    let result: unknown;
    if (action === "begin-review") { exactKeys(body, ["action", "operationId"]); result = await beginStoreOrderReview({ storeOrderReference: reference, actorUserId: actor.id, operationId, requestHash }); }
    else if (action === "accept") { exactKeys(body, ["action", "operationId", "preparationMinutes", "pickupInstructions"]); result = await acceptMarketplaceStoreOrder({ storeOrderReference: reference, actorUserId: actor.id, preparationMinutes: integer(body, "preparationMinutes"), pickupInstructions: text(body, "pickupInstructions", 1, 500), operationId, requestHash }); }
    else if (action === "reject") { exactKeys(body, ["action", "operationId", "reasonCode", "note"]); result = await rejectMarketplaceStoreOrder({ storeOrderReference: reference, actorUserId: actor.id, reasonCode: text(body, "reasonCode", 3, 80), note: typeof body.note === "string" ? body.note : undefined, operationId, requestHash }); }
    else if (action === "confirm-availability") { exactKeys(body, ["action", "operationId", "orderLineId", "availableQuantity", "reasonCode"]); result = await confirmStoreOrderLineAvailability({ storeOrderReference: reference, actorUserId: actor.id, orderLineId: text(body, "orderLineId", 5, 128), availableQuantity: integer(body, "availableQuantity"), reasonCode: typeof body.reasonCode === "string" ? body.reasonCode : undefined, operationId, requestHash }); }
    else if (action === "propose-substitution") { exactKeys(body, ["action", "operationId", "issueReference", "offerReference", "variantReference", "quantity"]); result = await proposeStoreOrderSubstitution({ storeOrderReference: reference, actorUserId: actor.id, issueReference: text(body, "issueReference", 5, 128), substituteOfferReference: text(body, "offerReference", 5, 128), substituteVariantReference: text(body, "variantReference", 5, 128), quantity: integer(body, "quantity"), operationId, requestHash }); }
    else if (action === "start-preparation") { exactKeys(body, ["action", "operationId"]); result = await startStoreOrderPreparation({ storeOrderReference: reference, actorUserId: actor.id, operationId, requestHash }); }
    else if (action === "update-preparation-time") { exactKeys(body, ["action", "operationId", "preparationMinutes", "reasonCode"]); result = await updateStoreOrderPreparationTime({ storeOrderReference: reference, actorUserId: actor.id, preparationMinutes: integer(body, "preparationMinutes"), reasonCode: text(body, "reasonCode", 3, 80), operationId, requestHash }); }
    else if (action === "mark-ready") { exactKeys(body, ["action", "operationId"]); result = await markStoreOrderReadyForHandoff({ storeOrderReference: reference, actorUserId: actor.id, operationId, requestHash }); }
    else if (action === "generate-pickup-code") { exactKeys(body, ["action", "operationId"]); result = await generateStoreOrderPickupChallenge({ storeOrderReference: reference, actorUserId: actor.id, operationId, requestHash }); }
    else return storeOrderJson({ error: "Unsupported store-order action." }, 422);
    return storeOrderJson({ result });
  } catch (error) { return storeOrderError(error); }
}
