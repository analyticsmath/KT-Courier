-- Distinguish platform-funded promotion expense from generic wallet accounts.
-- A dedicated purpose avoids collision with canonical held-funds liability.
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'PLATFORM_PROMOTION_EXPENSE';
