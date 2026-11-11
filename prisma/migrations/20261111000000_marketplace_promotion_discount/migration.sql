-- Forward migration: Support promotional discounts in MarketplaceCheckout and MarketplaceOrder invariants
ALTER TABLE "MarketplaceCheckout" ADD COLUMN IF NOT EXISTS "promotionDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "promotionDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "MarketplaceCheckout" DROP CONSTRAINT IF EXISTS "MarketplaceCheckout_totals_check";
ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_totals_check" CHECK (
  "currency" = 'ZAR' AND "reviewVersion" > 0 AND "version" > 0 AND "guestAccessTokenVersion" > 0 AND
  "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFeeTotal" >= 0 AND
  "promotionDiscount" >= 0 AND "grandTotal" >= 0 AND
  "grandTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFeeTotal" - "promotionDiscount"
);

ALTER TABLE "MarketplaceOrder" DROP CONSTRAINT IF EXISTS "MarketplaceOrder_total_check";
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_total_check" CHECK (
  "currency" = 'ZAR' AND "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFeeTotal" >= 0 AND
  "promotionDiscount" >= 0 AND "grandTotal" >= 0 AND
  "grandTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFeeTotal" - "promotionDiscount"
);
