-- Phase 7.5 closure. This migration only adds checks/backfills; previous
-- migrations remain immutable.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM "OrderAssignment"
    WHERE "status" IN ('ASSIGNED', 'ACCEPTED')
    GROUP BY "orderId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Phase 7.5 preflight failed: an order has multiple current assignments.';
  END IF;
END $$;

-- Preserve valid historical operational data by making a driver's configured
-- capacity at least its present active load before capacity enforcement begins.
UPDATE "DriverProfile" AS d
SET "maxConcurrentAssignments" = GREATEST(d."maxConcurrentAssignments", loads."activeCount")
FROM (
  SELECT "driverProfileId", count(*)::integer AS "activeCount"
  FROM "OrderAssignment"
  WHERE "status" IN ('ASSIGNED', 'ACCEPTED')
  GROUP BY "driverProfileId"
) AS loads
WHERE loads."driverProfileId" = d."id";

UPDATE "OrderAssignment"
SET "activeOrderGuard" = CASE
  WHEN "status" IN ('ASSIGNED', 'ACCEPTED') THEN "orderId"
  ELSE NULL
END;

UPDATE "Order" AS o
SET "currentDriverProfileId" = accepted."driverProfileId"
FROM (
  SELECT "orderId", "driverProfileId"
  FROM "OrderAssignment"
  WHERE "status" = 'ACCEPTED'
) AS accepted
WHERE accepted."orderId" = o."id";

UPDATE "Order" AS o
SET "currentDriverProfileId" = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM "OrderAssignment" AS a
  WHERE a."orderId" = o."id"
    AND a."status" = 'ACCEPTED'
    AND a."driverProfileId" = o."currentDriverProfileId"
);

ALTER TABLE "DriverProfile"
  ADD CONSTRAINT "DriverProfile_maxConcurrentAssignments_positive"
  CHECK ("maxConcurrentAssignments" > 0);

ALTER TABLE "PricingQuote"
  ADD CONSTRAINT "PricingQuote_zar_and_nonnegative"
  CHECK (
    "currency" = 'ZAR'
    AND "subtotal" >= 0
    AND "taxAmount" >= 0
    AND "total" >= 0
    AND "total" = "subtotal" + "taxAmount"
  );

ALTER TABLE "PricingQuoteLineItem"
  ADD CONSTRAINT "PricingQuoteLineItem_zar_and_nonnegative"
  CHECK ("currency" = 'ZAR' AND "amount" >= 0);

ALTER TABLE "OrderAssignment"
  ADD CONSTRAINT "OrderAssignment_current_guard_consistency"
  CHECK (
    (
      "status" IN ('ASSIGNED', 'ACCEPTED')
      AND "activeOrderGuard" IS NOT DISTINCT FROM "orderId"
    )
    OR
    (
      "status" NOT IN ('ASSIGNED', 'ACCEPTED')
      AND "activeOrderGuard" IS NULL
    )
  );

CREATE OR REPLACE FUNCTION "assert_order_current_driver_pointer"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_order_id TEXT;
  pointer_driver_id TEXT;
  accepted_driver_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Order' THEN
    target_order_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
  ELSE
    target_order_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."orderId" ELSE NEW."orderId" END;
  END IF;

  SELECT "currentDriverProfileId"
  INTO pointer_driver_id
  FROM "Order"
  WHERE "id" = target_order_id;

  SELECT "driverProfileId"
  INTO accepted_driver_id
  FROM "OrderAssignment"
  WHERE "orderId" = target_order_id
    AND "status" = 'ACCEPTED';

  IF pointer_driver_id IS DISTINCT FROM accepted_driver_id THEN
    RAISE EXCEPTION
      'Order % currentDriverProfileId must match its accepted assignment',
      target_order_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Order_current_driver_pointer_matches_assignment"
AFTER INSERT OR UPDATE OR DELETE ON "Order"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_order_current_driver_pointer"();

CREATE CONSTRAINT TRIGGER "OrderAssignment_current_driver_pointer_matches_assignment"
AFTER INSERT OR UPDATE OR DELETE ON "OrderAssignment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_order_current_driver_pointer"();
