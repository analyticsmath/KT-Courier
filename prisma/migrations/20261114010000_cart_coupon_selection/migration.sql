-- Store only a reference to the keyed coupon record, never the customer's plaintext code.
ALTER TABLE "MarketplaceCart" ADD COLUMN "appliedPromotionCodeId" TEXT;
ALTER TABLE "MarketplaceCart" ADD CONSTRAINT "MarketplaceCart_appliedPromotionCodeId_fkey"
  FOREIGN KEY ("appliedPromotionCodeId") REFERENCES "PromotionCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MarketplaceCart_appliedPromotionCodeId_idx" ON "MarketplaceCart"("appliedPromotionCodeId");
