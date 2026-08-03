-- Phase 9: immutable double-entry wallet ledger foundation.
-- Existing Phase 4 finance tables are preserved. Unsupported legacy financial
-- state blocks this migration instead of being copied without ledger evidence.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Wallet"
    WHERE "availableBalance" <> 0
       OR "pendingBalance" <> 0
       OR "lockedBalance" <> 0
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Phase 9 migration blocked: non-zero legacy wallet balances require an architect-approved balanced opening-journal backfill.';
  END IF;

  IF EXISTS (SELECT 1 FROM "WalletTransaction") THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Phase 9 migration blocked: legacy wallet transactions require explicit financial-data reconciliation.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Wallet" WHERE "currency" <> 'ZAR') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Phase 9 migration blocked: Phase 9 supports ZAR wallets only.';
  END IF;
END $$;

CREATE TYPE "LedgerCurrency" AS ENUM ('ZAR');
CREATE TYPE "LedgerAccountPurpose" AS ENUM (
  'AVAILABLE',
  'PENDING',
  'HELD',
  'CASH_CLEARING',
  'SETTLEMENT_CLEARING',
  'PLATFORM_REVENUE',
  'ADJUSTMENT',
  'SUSPENSE',
  'OPENING_BALANCE_CONTROL',
  'OWNER_WITHDRAWABLE',
  'WITHDRAWAL_HELD',
  'COMMISSION_PAYABLE',
  'CUSTOMER_WALLET_AVAILABLE',
  'CUSTOMER_REFUND_HELD',
  'STORE_EARNINGS_PAYABLE',
  'DRIVER_EARNINGS_PAYABLE'
);
CREATE TYPE "LedgerAccountCategory" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY');
CREATE TYPE "LedgerAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE "LedgerJournalType" AS ENUM (
  'GENERAL',
  'ACCOUNT_TRANSFER',
  'OPENING_BALANCE',
  'REVERSAL',
  'EXTERNAL_PAYMENT_RECEIPT',
  'WITHDRAWAL_RESERVE',
  'WITHDRAWAL_RELEASE',
  'WITHDRAWAL_PAYOUT',
  'COMMISSION_ACCRUAL',
  'COMMISSION_REVERSAL',
  'REFUND_RESERVE',
  'REFUND_RELEASE',
  'REFUND_WALLET_CREDIT',
  'REFUND_EXTERNAL_PAYOUT',
  'STORE_EARNING_ACCRUAL',
  'STORE_EARNING_RELEASE',
  'STORE_EARNING_REVERSAL',
  'DRIVER_EARNING_ACCRUAL',
  'DRIVER_EARNING_RELEASE',
  'DRIVER_EARNING_REVERSAL'
);
CREATE TYPE "LedgerEntryDirection" AS ENUM ('DEBIT', 'CREDIT');

ALTER TABLE "Wallet"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Phase 9 makes immutable ledger entries the evidence and account projections
-- the only writable current-balance projection. The legacy fields stay present
-- for schema compatibility but cannot diverge from their supported zero state.
ALTER TABLE "Wallet"
  ADD CONSTRAINT "Wallet_legacy_balances_zero_check"
  CHECK (
    "availableBalance" = 0
    AND "pendingBalance" = 0
    AND "lockedBalance" = 0
  ),
  ADD CONSTRAINT "Wallet_version_nonnegative_check"
  CHECK ("version" >= 0);

COMMENT ON COLUMN "Wallet"."availableBalance" IS 'Deprecated Phase 4 placeholder. Canonical Phase 9 projections live on LedgerAccount.';
COMMENT ON COLUMN "Wallet"."pendingBalance" IS 'Deprecated Phase 4 placeholder. Canonical Phase 9 projections live on LedgerAccount.';
COMMENT ON COLUMN "Wallet"."lockedBalance" IS 'Deprecated Phase 4 placeholder. Canonical Phase 9 projections live on LedgerAccount.';
COMMENT ON TABLE "WalletTransaction" IS 'Deprecated Phase 4 future-workflow placeholder. Not a Phase 9 posting path or accounting evidence.';

CREATE TABLE "LedgerAccount" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "purpose" "LedgerAccountPurpose" NOT NULL,
  "category" "LedgerAccountCategory" NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "status" "LedgerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "allowNegative" BOOLEAN NOT NULL DEFAULT false,
  "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "debitTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "creditTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerAccount_projection_check" CHECK (
    "debitTotal" >= 0
    AND "creditTotal" >= 0
    AND "version" >= 0
    AND ("allowNegative" OR "currentBalance" >= 0)
  )
);

CREATE TABLE "LedgerJournal" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "type" "LedgerJournalType" NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "sourceReference" TEXT,
  "correlationId" TEXT,
  "memo" TEXT,
  "metadata" JSONB,
  "policyVersion" TEXT NOT NULL,
  "totalDebits" DECIMAL(18,2) NOT NULL,
  "totalCredits" DECIMAL(18,2) NOT NULL,
  "reversalOfJournalId" TEXT,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LedgerJournal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerJournal_balanced_totals_check" CHECK (
    "totalDebits" > 0
    AND "totalDebits" = "totalCredits"
  ),
  CONSTRAINT "LedgerJournal_request_hash_check" CHECK (length("requestHash") = 64),
  CONSTRAINT "LedgerJournal_idempotency_key_check" CHECK (length(btrim("idempotencyKey")) > 0),
  CONSTRAINT "LedgerJournal_not_self_reversal_check" CHECK ("reversalOfJournalId" IS NULL OR "reversalOfJournalId" <> "id")
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "direction" "LedgerEntryDirection" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "lineCode" TEXT NOT NULL,
  "memo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerEntry_amount_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "LedgerEntry_sequence_positive_check" CHECK ("sequence" > 0),
  CONSTRAINT "LedgerEntry_line_code_check" CHECK (length(btrim("lineCode")) > 0)
);

-- Account identity and overdraft policy are fixed once immutable evidence exists.
-- Projection totals, version, timestamps, and status remain legitimately mutable.
CREATE FUNCTION "protect_posted_ledger_account_identity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "LedgerEntry" WHERE "accountId" = OLD."id")
     AND (
       OLD."walletId" IS DISTINCT FROM NEW."walletId"
       OR OLD."code" IS DISTINCT FROM NEW."code"
       OR OLD."purpose" IS DISTINCT FROM NEW."purpose"
       OR OLD."category" IS DISTINCT FROM NEW."category"
       OR OLD."currency" IS DISTINCT FROM NEW."currency"
       OR OLD."allowNegative" IS DISTINCT FROM NEW."allowNegative"
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Posted ledger account identity and overdraft policy are immutable.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "LedgerAccount_posted_identity_immutable"
BEFORE UPDATE ON "LedgerAccount"
FOR EACH ROW
EXECUTE FUNCTION "protect_posted_ledger_account_identity"();

CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");
CREATE UNIQUE INDEX "LedgerAccount_walletId_purpose_currency_key" ON "LedgerAccount"("walletId", "purpose", "currency");
CREATE INDEX "LedgerAccount_walletId_status_idx" ON "LedgerAccount"("walletId", "status");
CREATE INDEX "LedgerAccount_category_currency_idx" ON "LedgerAccount"("category", "currency");

CREATE UNIQUE INDEX "LedgerJournal_reference_key" ON "LedgerJournal"("reference");
CREATE UNIQUE INDEX "LedgerJournal_idempotencyKey_key" ON "LedgerJournal"("idempotencyKey");
CREATE UNIQUE INDEX "LedgerJournal_sourceReference_key" ON "LedgerJournal"("sourceReference");
CREATE UNIQUE INDEX "LedgerJournal_reversalOfJournalId_key" ON "LedgerJournal"("reversalOfJournalId");
CREATE INDEX "LedgerJournal_type_postedAt_idx" ON "LedgerJournal"("type", "postedAt");
CREATE INDEX "LedgerJournal_currency_postedAt_idx" ON "LedgerJournal"("currency", "postedAt");
CREATE INDEX "LedgerJournal_correlationId_idx" ON "LedgerJournal"("correlationId");
CREATE INDEX "LedgerJournal_createdByUserId_idx" ON "LedgerJournal"("createdByUserId");

CREATE UNIQUE INDEX "LedgerEntry_journalId_sequence_key" ON "LedgerEntry"("journalId", "sequence");
CREATE UNIQUE INDEX "LedgerEntry_journalId_lineCode_key" ON "LedgerEntry"("journalId", "lineCode");
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");
CREATE INDEX "LedgerEntry_journalId_idx" ON "LedgerEntry"("journalId");

ALTER TABLE "LedgerAccount"
  ADD CONSTRAINT "LedgerAccount_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerJournal"
  ADD CONSTRAINT "LedgerJournal_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerJournal"
  ADD CONSTRAINT "LedgerJournal_reversalOfJournalId_fkey"
  FOREIGN KEY ("reversalOfJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_journalId_fkey"
  FOREIGN KEY ("journalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level immutability enforcement for LedgerJournal and LedgerEntry
CREATE FUNCTION "protect_ledger_journal_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23514', -- CHECK VIOLATION
    MESSAGE = 'Ledger journals are immutable and cannot be modified or deleted.';
END $$;

CREATE TRIGGER "LedgerJournal_immutability_protection"
BEFORE UPDATE OR DELETE ON "LedgerJournal"
FOR EACH ROW
EXECUTE FUNCTION "protect_ledger_journal_immutability"();

CREATE FUNCTION "protect_ledger_entry_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23514', -- CHECK VIOLATION
    MESSAGE = 'Ledger entries are immutable and cannot be modified or deleted.';
END $$;

CREATE TRIGGER "LedgerEntry_immutability_protection"
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION "protect_ledger_entry_immutability"();

