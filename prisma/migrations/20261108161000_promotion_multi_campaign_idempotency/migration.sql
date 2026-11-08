-- A checkout reservation/commit command can carry multiple independently
-- funded campaigns. A globally unique operationId incorrectly allows only
-- the first row and rolls back the remainder. PromotionOperation remains
-- unique by operationId and is the command idempotency receipt.
-- Existing one-campaign records retain their identity and are not rewritten.
DROP INDEX IF EXISTS "PromotionReservation_operationId_key";
CREATE UNIQUE INDEX "PromotionReservation_operation_campaign_key"
  ON "PromotionReservation" ("operationId", "campaignVersionId");

DROP INDEX IF EXISTS "PromotionRedemption_operationId_key";
CREATE INDEX "PromotionRedemption_operationId_idx"
  ON "PromotionRedemption" ("operationId");
