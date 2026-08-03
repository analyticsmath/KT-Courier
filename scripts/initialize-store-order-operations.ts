/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 21 runtime client generation is deferred. */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { initializeMarketplaceStoreOrderOperations } from "@/lib/store-orders/store-order.service";

async function main() {
  const rows = await (prisma as any).marketplaceStoreOrder.findMany({ where: { status: "SETTLED", operationalPolicyId: null }, select: { publicReference: true } });
  for (const row of rows) {
    const operationId = `phase21-initialize-${row.publicReference.replace(/[^A-Za-z0-9_-]/g, "").slice(-100)}`;
    await initializeMarketplaceStoreOrderOperations({ storeOrderReference: row.publicReference, operationId, requestHash: createHash("sha256").update(operationId).digest("hex") });
  }
}
void main();
