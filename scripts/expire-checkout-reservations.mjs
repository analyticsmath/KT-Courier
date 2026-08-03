import { runBoundedMarketplaceScan } from "./marketplace-checkout-script-support.mjs";
await runBoundedMarketplaceScan("expire-checkout-reservations", (limit) => `SELECT "publicReference" FROM "MarketplaceInventoryReservation" WHERE "status"::text='ACTIVE' AND "expiresAt"<=CURRENT_TIMESTAMP ORDER BY "expiresAt" ASC LIMIT ${limit}`, "scripts/phase20-expire-checkout-reservations.worker.ts");
