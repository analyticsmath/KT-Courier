import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { exactKeys, enforceStoreOrderMutation, integer, storeOrderBody, storeOrderError, storeOrderJson, text } from "@/lib/store-orders/api-policy";
import { verifyStoreOrderPickupHandoff } from "@/lib/store-orders/store-order.service";

/** The driver authenticates this second factor; store staff never submit a
 * driver identity or mark the courier delivery complete. */
export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const blocked = await enforceStoreOrderMutation(request, "handoff"); if (blocked) return blocked;
    const driver = await getCurrentUser(); if (!driver || driver.role !== "DRIVER") return storeOrderJson({ error: "An active driver session is required." }, 403);
    const profile = await prisma.driverProfile.findFirst({ where: { userId: driver.id, status: "ACTIVE" }, select: { id: true } });
    if (!profile) return storeOrderJson({ error: "An active driver profile is required." }, 403);
    const { reference } = await context.params; const body = await storeOrderBody(request); exactKeys(body, ["operationId", "pickupCode", "packageCount"]);
    const operationId = text(body, "operationId", 12, 160); const result = await verifyStoreOrderPickupHandoff({ storeOrderReference: reference, driverUserId: driver.id, driverProfileId: profile.id, pickupCode: text(body, "pickupCode", 6, 6), packageEvidence: { packageCount: integer(body, "packageCount") }, operationId, requestHash: createHash("sha256").update(`handoff:${JSON.stringify(body)}`).digest("hex") });
    return storeOrderJson({ result });
  } catch (error) { return storeOrderError(error); }
}
