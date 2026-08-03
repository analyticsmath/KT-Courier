/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { createPrismaMarketplaceSettlementRepository } from "@/lib/marketplace-checkout/prisma-marketplace-settlement.repository";
import { settleMarketplaceStoreOrder } from "@/lib/marketplace-checkout/settlement.service";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
const jobs = await (prisma as any).marketplaceStoreSettlementJob.findMany({ where: { status: { in: ["PENDING", "RETRYABLE"] }, nextAttemptAt: { lte: new Date() } }, include: { marketplaceStoreOrder: { select: { publicReference: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit });
for (const job of jobs) {
  await settleMarketplaceStoreOrder({ marketplaceStoreOrderReference: job.marketplaceStoreOrder.publicReference, operationId: job.operationId }, createPrismaMarketplaceSettlementRepository());
  console.log(JSON.stringify({ jobReference: job.publicReference, operation: "settleMarketplaceStoreOrder" }));
}
