/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { exactKeys, enforceStoreOrderMutation, storeOrderBody, storeOrderError, storeOrderJson, text } from "@/lib/store-orders/api-policy";
import { assertStoreOrderProductionReady } from "@/lib/store-orders/production-lock";
import { startProviderRefund } from "@/lib/services/refund-provider-execution.service";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const blocked = await enforceStoreOrderMutation(request, "admin"); if (blocked) return blocked;
    assertStoreOrderProductionReady("REFUND");
    const auth = await requireAdminApiPermission(PERMISSIONS.STORE_ORDERS_RETRY_REFUND, { request }); if (auth.response) return auth.response;
    const body = await storeOrderBody(request); exactKeys(body, ["operationId"]); const operationId = text(body, "operationId", 12, 160); const { reference } = await context.params;
    const adjustment = await (prisma as any).marketplaceStoreOrderAdjustment.findFirst({ where: { storeOrder: { publicReference: reference }, status: "REFUND_PENDING", refund: { status: "APPROVED" } }, orderBy: { appliedAt: "asc" }, select: { refund: { select: { publicReference: true } } } });
    if (!adjustment?.refund?.publicReference) return storeOrderJson({ error: "No Phase 15 approved refund is eligible for provider retry." }, 404);
    const result = await startProviderRefund({ actorUserId: auth.user.id, publicReference: adjustment.refund.publicReference, operationId: createHash("sha256").update(`store-order-refund:${reference}:${operationId}`).digest("hex") });
    return storeOrderJson({ result });
  } catch (error) { return storeOrderError(error); }
}
