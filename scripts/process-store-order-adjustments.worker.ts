/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { applyMarketplaceStoreOrderAdjustment } from "@/lib/store-orders/store-order.service";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
const adjustments = await (prisma as any).marketplaceStoreOrderAdjustment.findMany({ where: { status: { in: ["APPROVED", "RECONCILIATION_REQUIRED"] } }, include: { storeOrder: { select: { publicReference: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit });
for (const adjustment of adjustments) {
  const operationId = `phase21-adjustment-${adjustment.publicReference.replace(/[^A-Za-z0-9_-]/g, "").slice(-100)}`;
  await applyMarketplaceStoreOrderAdjustment({ storeOrderReference: adjustment.storeOrder.publicReference, adjustmentReference: adjustment.publicReference, actorUserId: "SYSTEM", operationId, requestHash: createHash("sha256").update(operationId).digest("hex") });
  console.log(JSON.stringify({ adjustmentReference: adjustment.publicReference, operation: "applyMarketplaceStoreOrderAdjustment" }));
}
