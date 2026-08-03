import { runBoundedMarketplaceScan } from "./marketplace-checkout-script-support.mjs";
await runBoundedMarketplaceScan("expire-marketplace-carts", `SELECT "publicReference" FROM "MarketplaceCart" WHERE "status"::text='ACTIVE' AND "expiresAt" IS NOT NULL AND "expiresAt"<=CURRENT_TIMESTAMP LIMIT 100`, { mutating: true });
