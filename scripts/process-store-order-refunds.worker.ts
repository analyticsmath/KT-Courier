/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { assertStoreOrderProductionReady } from "@/lib/store-orders/production-lock";
import { startProviderRefund } from "@/lib/services/refund-provider-execution.service";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
assertStoreOrderProductionReady("REFUND");
const rows = await (prisma as any).marketplaceStoreOrderAdjustment.findMany({ where: { status: "REFUND_PENDING", refund: { status: "APPROVED" } }, include: { refund: { select: { publicReference: true } } }, orderBy: [{ appliedAt: "asc" }, { id: "asc" }], take: limit });
for (const row of rows) {
  if (!row.refund) continue;
  const operationId = `phase21-refund-${row.refund.publicReference.replace(/[^A-Za-z0-9_-]/g, "").slice(-100)}`;
  await startProviderRefund({ actorUserId: "SYSTEM", publicReference: row.refund.publicReference, operationId });
  console.log(JSON.stringify({ refundReference: row.refund.publicReference, operation: "startProviderRefund" }));
}
