import { runBoundedMarketplaceScan } from "./marketplace-checkout-script-support.mjs";

await runBoundedMarketplaceScan(
  "scan-store-order-reconciliation",
  (limit) => `SELECT "publicReference", "reasonCode", "status" FROM "MarketplaceStoreOrderReconciliationCase" WHERE "status"::text<>'RESOLVED' ORDER BY "updatedAt" ASC LIMIT ${limit}`,
  "scripts/scan-store-order-reconciliation.worker.ts",
);
