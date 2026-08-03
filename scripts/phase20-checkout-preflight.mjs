import { runBoundedMarketplaceScan } from "./marketplace-checkout-script-support.mjs";
await runBoundedMarketplaceScan("phase20-checkout-preflight", `SELECT "publicReference", "status" FROM "MarketplaceCheckout" WHERE "currency"::text<>'ZAR' OR "grandTotal"<>"merchandiseSubtotal"+"modifierSubtotal"+"deliveryFeeTotal" LIMIT 100`);
