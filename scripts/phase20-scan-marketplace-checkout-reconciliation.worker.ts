/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { onVerifiedMarketplacePaymentSucceededInProduction } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";
import { createPrismaMarketplaceSettlementRepository } from "@/lib/marketplace-checkout/prisma-marketplace-settlement.repository";
import { settleMarketplaceStoreOrder } from "@/lib/marketplace-checkout/settlement.service";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
const cases = await (prisma as any).marketplaceCheckoutReconciliationCase.findMany({ where: { status: { not: "RESOLVED" } }, include: { payment: true, marketplaceStoreOrder: true }, orderBy: { updatedAt: "asc" }, take: limit });
for (const caseRow of cases) {
  if (caseRow.payment?.status === "SUCCEEDED" && !caseRow.marketplaceStoreOrder) await onVerifiedMarketplacePaymentSucceededInProduction(caseRow.payment.id);
  if (caseRow.marketplaceStoreOrder) await settleMarketplaceStoreOrder({ marketplaceStoreOrderReference: caseRow.marketplaceStoreOrder.publicReference, operationId: `marketplace-rescan:${caseRow.id}` }, createPrismaMarketplaceSettlementRepository());
  console.log(JSON.stringify({ reconciliationReference: caseRow.publicReference, operation: "canonical-rescan" }));
}
