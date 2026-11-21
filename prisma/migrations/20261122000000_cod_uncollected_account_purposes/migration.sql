-- Each platform wallet account requires its own purpose. Keep uncollected
-- receivables distinct from the liability and from collected-cash shortages.
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'COD_UNCOLLECTED_RECEIVABLE';
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'COD_UNCOLLECTED_SUSPENSE';
