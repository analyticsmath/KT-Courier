-- Holds change reserved/available quantities, not physical on-hand stock.
-- Preserve the non-zero physical movement rule and all existing bounds.
BEGIN;
ALTER TABLE "CatalogInventoryMovement" DROP CONSTRAINT "CatalogInventoryMovement_result_check";
ALTER TABLE "CatalogInventoryMovement" ADD CONSTRAINT "CatalogInventoryMovement_result_check" CHECK (
  "resultingOnHand" >= 0
  AND ("quantityDelta" <> 0 OR "type" IN ('RESERVATION', 'RESERVATION_RELEASE', 'ORDER_SUBSTITUTION_RESERVATION', 'ORDER_SUBSTITUTION_RELEASE'))
  AND length("operationId") BETWEEN 8 AND 160
  AND length("requestHash") BETWEEN 16 AND 128
);
COMMIT;
