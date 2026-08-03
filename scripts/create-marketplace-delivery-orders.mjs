import { runBoundedMarketplaceScan } from "./marketplace-checkout-script-support.mjs";

await runBoundedMarketplaceScan(
  "create-marketplace-delivery-orders",
  (limit) => `SELECT "publicReference", "deliveryBridgeStatus" FROM "MarketplaceStoreOrder" WHERE "deliveryBridgeStatus"::text IN ('REQUEST_PENDING','FAILED') ORDER BY "createdAt" ASC LIMIT ${limit}`,
  "scripts/create-marketplace-delivery-orders.worker.ts",
);
