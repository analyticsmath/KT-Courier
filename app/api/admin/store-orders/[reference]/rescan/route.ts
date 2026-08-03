import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { exactKeys, enforceStoreOrderMutation, storeOrderBody, storeOrderError, storeOrderJson, text } from "@/lib/store-orders/api-policy";
import { createStoreOrderReconciliationCase } from "@/lib/store-orders/store-order.service";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const blocked = await enforceStoreOrderMutation(request, "admin"); if (blocked) return blocked;
    const auth = await requireAdminApiPermission(PERMISSIONS.STORE_ORDERS_RESCAN, { request }); if (auth.response) return auth.response;
    const body = await storeOrderBody(request); exactKeys(body, ["operationId"]); const operationId = text(body, "operationId", 12, 160);
    const { reference } = await context.params;
    const result = await createStoreOrderReconciliationCase({ storeOrderReference: reference, reasonCode: "ADMIN_CANONICAL_RESCAN", safeSummary: "Administrator requested a canonical coherence rescan.", operationId, evidence: { actorUserId: auth.user.id, requestHash: createHash("sha256").update(JSON.stringify(body)).digest("hex") } });
    return storeOrderJson({ result });
  } catch (error) { return storeOrderError(error); }
}
