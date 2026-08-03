/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
const cases = await (prisma as any).marketplaceStoreOrderReconciliationCase.findMany({ where: { status: { not: "RESOLVED" } }, select: { publicReference: true, reasonCode: true, priority: true, observationCount: true }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limit });
for (const reconciliation of cases) console.log(JSON.stringify({ reconciliationReference: reconciliation.publicReference, reasonCode: reconciliation.reasonCode, priority: reconciliation.priority, observationCount: reconciliation.observationCount, operation: "admin-reconciliation-queue" }));
