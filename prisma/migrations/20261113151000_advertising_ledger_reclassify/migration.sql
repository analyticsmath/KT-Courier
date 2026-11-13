-- Preserve ledger account IDs, balances, and journal references. Refuse unexpected
-- legacy ownership or category instead of silently reclassifying another account.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "LedgerAccount" a JOIN "Wallet" w ON w.id = a."walletId"
    WHERE a.code IN ('PLATFORM-ADVERTISING-FUNDS-HELD-ZAR', 'PLATFORM-ADVERTISING-REVENUE-ZAR')
      AND (w."ownerType" <> 'PLATFORM' OR w."ownerId" <> 'platform' OR a.currency <> 'ZAR'
        OR (a.code = 'PLATFORM-ADVERTISING-FUNDS-HELD-ZAR' AND (a.category <> 'LIABILITY' OR a.purpose NOT IN ('HELD', 'ADVERTISING_FUNDS_HELD')))
        OR (a.code = 'PLATFORM-ADVERTISING-REVENUE-ZAR' AND (a.category <> 'REVENUE' OR a.purpose NOT IN ('PLATFORM_REVENUE', 'ADVERTISING_REVENUE'))))
  ) THEN
    RAISE EXCEPTION 'Unexpected advertising ledger account requires manual reconciliation';
  END IF;
END $$;
UPDATE "LedgerAccount" SET purpose = 'ADVERTISING_FUNDS_HELD' WHERE code = 'PLATFORM-ADVERTISING-FUNDS-HELD-ZAR' AND purpose = 'HELD';
UPDATE "LedgerAccount" SET purpose = 'ADVERTISING_REVENUE' WHERE code = 'PLATFORM-ADVERTISING-REVENUE-ZAR' AND purpose = 'PLATFORM_REVENUE';
