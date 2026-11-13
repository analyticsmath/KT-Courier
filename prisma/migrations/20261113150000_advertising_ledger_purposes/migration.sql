-- Distinct purposes keep advertising liabilities and revenue separate from customer funds.
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'ADVERTISING_FUNDS_HELD';
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'ADVERTISING_REVENUE';
