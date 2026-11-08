-- The original foundation seed mislabeled a dedicated expense as suspense.
-- Backfill its purpose without touching amounts, journals or unrelated wallets.
-- Reject unexpected account ownership/category instead of silently relabeling.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "LedgerAccount" a
    JOIN "Wallet" w ON w."id" = a."walletId"
    WHERE a."code" = 'PLATFORM-PROMOTION-EXPENSE-ZAR'
      AND (
        a."purpose"::text NOT IN ('SUSPENSE', 'PLATFORM_PROMOTION_EXPENSE')
        OR a."category"::text <> 'EXPENSE'
        OR w."ownerType"::text <> 'PLATFORM'
        OR w."ownerId" <> 'platform'
        OR w."currency" <> 'ZAR'
        OR a."allowNegative" = true
      )
  ) THEN
    RAISE EXCEPTION 'Invalid platform promotion expense account: human reconciliation required';
  END IF;
END $$;
UPDATE "LedgerAccount"
SET "purpose" = 'PLATFORM_PROMOTION_EXPENSE'
WHERE "code" = 'PLATFORM-PROMOTION-EXPENSE-ZAR'
  AND "purpose" = 'SUSPENSE' AND "category" = 'EXPENSE';
