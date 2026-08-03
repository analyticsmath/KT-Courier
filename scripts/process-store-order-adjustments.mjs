import { runBoundedMarketplaceScan } from "./marketplace-checkout-script-support.mjs";

await runBoundedMarketplaceScan(
  "process-store-order-adjustments",
  (limit) => `SELECT "publicReference", "status" FROM "MarketplaceStoreOrderAdjustment" WHERE "status"::text IN ('APPROVED','RECONCILIATION_REQUIRED') ORDER BY "createdAt" ASC LIMIT ${limit}`,
  "scripts/process-store-order-adjustments.worker.ts",
);
