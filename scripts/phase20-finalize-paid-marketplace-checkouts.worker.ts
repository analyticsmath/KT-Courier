/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { onVerifiedMarketplacePaymentSucceededInProduction } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
const payments = await (prisma as any).payment.findMany({ where: { subjectType: "MARKETPLACE_CHECKOUT", status: "SUCCEEDED", marketplaceOrderId: null }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true, publicReference: true } });
for (const payment of payments) {
  // Phase 12 hook creates/replays the durable receipt and invokes the same finalizer.
  await onVerifiedMarketplacePaymentSucceededInProduction(payment.id);
  console.log(JSON.stringify({ paymentReference: payment.publicReference, operation: "finalizePaidMarketplaceCheckout" }));
}
