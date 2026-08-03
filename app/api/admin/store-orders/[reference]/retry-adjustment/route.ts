/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { exactKeys, enforceStoreOrderMutation, storeOrderBody, storeOrderError, storeOrderJson, text } from "@/lib/store-orders/api-policy";
import { applyMarketplaceStoreOrderAdjustment } from "@/lib/store-orders/store-order.service";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const blocked = await enforceStoreOrderMutation(request, "admin"); if (blocked) return blocked;
    const auth = await requireAdminApiPermission(PERMISSIONS.STORE_ORDERS_RETRY_ADJUSTMENT, { request }); if (auth.response) return auth.response;
    const body = await storeOrderBody(request); exactKeys(body, ["operationId"]); const operationId = text(body, "operationId", 12, 160); const { reference } = await context.params;
    const adjustment = await (prisma as any).marketplaceStoreOrderAdjustment.findFirst({ where: { storeOrder: { publicReference: reference }, status: { in: ["APPROVED", "APPLYING", "RECONCILIATION_REQUIRED"] } }, orderBy: { createdAt: "asc" }, select: { publicReference: true } });
    if (!adjustment) return storeOrderJson({ error: "No canonical adjustment is eligible for retry." }, 404);
    const result = await applyMarketplaceStoreOrderAdjustment({ storeOrderReference: reference, adjustmentReference: adjustment.publicReference, actorUserId: auth.user.id, operationId, requestHash: createHash("sha256").update(`retry-adjustment:${JSON.stringify(body)}`).digest("hex") });
    return storeOrderJson({ result });
  } catch (error) { return storeOrderError(error); }
}
