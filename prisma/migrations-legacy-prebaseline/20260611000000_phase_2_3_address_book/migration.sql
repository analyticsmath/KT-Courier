-- KT Couriers Phase 2.3
-- Saved customer addresses and store default pickup address foundation.
-- This migration is intentionally incremental because the repository did not
-- include a checked-in baseline migration before Phase 2.3.

ALTER TABLE IF EXISTS "Address"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "storeId" TEXT,
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS "Store"
  ADD COLUMN IF NOT EXISTS "defaultPickupAddressId" TEXT;

CREATE INDEX IF NOT EXISTS "Address_userId_idx" ON "Address"("userId");
CREATE INDEX IF NOT EXISTS "Address_storeId_idx" ON "Address"("storeId");
CREATE INDEX IF NOT EXISTS "Address_userId_type_isDefault_idx" ON "Address"("userId", "type", "isDefault");
CREATE INDEX IF NOT EXISTS "Address_storeId_type_isDefault_idx" ON "Address"("storeId", "type", "isDefault");
CREATE INDEX IF NOT EXISTS "Store_defaultPickupAddressId_idx" ON "Store"("defaultPickupAddressId");

DO $$
BEGIN
  IF to_regclass('"Address"') IS NOT NULL
     AND to_regclass('"User"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'Address_userId_fkey'
     ) THEN
    ALTER TABLE "Address"
      ADD CONSTRAINT "Address_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('"Address"') IS NOT NULL
     AND to_regclass('"Store"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'Address_storeId_fkey'
     ) THEN
    ALTER TABLE "Address"
      ADD CONSTRAINT "Address_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('"Store"') IS NOT NULL
     AND to_regclass('"Address"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'Store_defaultPickupAddressId_fkey'
     ) THEN
    ALTER TABLE "Store"
      ADD CONSTRAINT "Store_defaultPickupAddressId_fkey"
      FOREIGN KEY ("defaultPickupAddressId") REFERENCES "Address"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
