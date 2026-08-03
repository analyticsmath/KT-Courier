/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { createMarketplaceDeliveryBridge } from "@/lib/store-orders/store-order.service";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
const rows = await (prisma as any).marketplaceStoreOrder.findMany({ where: { deliveryBridgeStatus: { in: ["REQUEST_PENDING", "FAILED"] } }, select: { publicReference: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit });
for (const row of rows) {
  const operationId = `phase21-delivery-${row.publicReference.replace(/[^A-Za-z0-9_-]/g, "").slice(-100)}`;
  await createMarketplaceDeliveryBridge({ storeOrderReference: row.publicReference, actorUserId: "SYSTEM", operationId, requestHash: createHash("sha256").update(operationId).digest("hex") });
  console.log(JSON.stringify({ storeOrderReference: row.publicReference, operation: "createMarketplaceDeliveryBridge" }));
}
