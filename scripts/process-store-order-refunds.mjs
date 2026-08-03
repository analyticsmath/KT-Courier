import { runBoundedMarketplaceScan } from "./marketplace-checkout-script-support.mjs";

await runBoundedMarketplaceScan(
  "process-store-order-refunds",
  (limit) => `SELECT r."publicReference" FROM "PaymentRefund" r INNER JOIN "MarketplaceStoreOrderAdjustment" a ON a."refundId" = r."id" WHERE a."status"::text='REFUND_PENDING' AND r."status"::text='APPROVED' ORDER BY a."appliedAt" ASC LIMIT ${limit}`,
  "scripts/process-store-order-refunds.worker.ts",
);
