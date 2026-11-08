-- Changing one-operation/one-campaign uniqueness to support multiple
-- independently funded campaigns must not expose a live write interval where
-- neither uniqueness guarantee exists. A transaction keeps both DDL swaps
-- atomic and rolls everything back if either replacement index fails.
-- PromotionOperation(operationId) remains the unique command-level receipt.
BEGIN;

-- Build the stricter per-campaign identity before releasing the old
-- operation-level index. Previously valid rows stay valid.
CREATE UNIQUE INDEX "PromotionReservation_operation_campaign_key"
  ON "PromotionReservation" ("operationId", "campaignVersionId");
DROP INDEX IF EXISTS "PromotionReservation_operationId_key";

-- Retain an operationId lookup index for replay/reconciliation while allowing
-- one redemption per campaign from the same successfully funded command.
CREATE INDEX "PromotionRedemption_operationId_idx"
  ON "PromotionRedemption" ("operationId");
DROP INDEX IF EXISTS "PromotionRedemption_operationId_key";

COMMIT;
