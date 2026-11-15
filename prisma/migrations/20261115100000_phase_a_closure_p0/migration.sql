-- Phase A P0 Closure (F01, F03, F04):
-- 1. Extend StoreCheckoutCertification with additive provenance and disposable checkout engine proof metadata.
-- 2. Extend PaymentRefund with optional beneficiaryStoreId and store wallet refund journal verification.
-- 3. Create ParcelCancellationResolution for durable idempotent cancellation-to-payment coordination.

ALTER TABLE "StoreCheckoutCertification"
  ADD COLUMN IF NOT EXISTS "evidenceType" TEXT NOT NULL DEFAULT 'OPERATOR_SUPPLIED_EVIDENCE',
  ADD COLUMN IF NOT EXISTS "engineProofReference" TEXT,
  ADD COLUMN IF NOT EXISTS "engineProofDigest" TEXT,
  ADD COLUMN IF NOT EXISTS "engineProofSuiteSha" TEXT,
  ADD COLUMN IF NOT EXISTS "policyFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "stageResults" JSONB;

ALTER TABLE "PaymentRefund"
  ADD COLUMN IF NOT EXISTS "beneficiaryStoreId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRefund_beneficiaryStoreId_fkey'
  ) THEN
    ALTER TABLE "PaymentRefund"
      ADD CONSTRAINT "PaymentRefund_beneficiaryStoreId_fkey"
      FOREIGN KEY ("beneficiaryStoreId") REFERENCES "Store"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PaymentRefund_beneficiaryStoreId_createdAt_idx"
  ON "PaymentRefund"("beneficiaryStoreId", "createdAt");

CREATE TABLE "ParcelCancellationResolution" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT,
  "status" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "walletOwnerType" TEXT,
  "walletOwnerId" TEXT,
  "walletRefundJournalId" TEXT,
  "paymentRefundId" TEXT,
  "reconciliationCaseId" TEXT,
  "decisionEvidence" JSONB,
  "version" INTEGER NOT NULL DEFAULT 0,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParcelCancellationResolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ParcelCancellationResolution_publicReference_key"
  ON "ParcelCancellationResolution"("publicReference");
CREATE UNIQUE INDEX IF NOT EXISTS "ParcelCancellationResolution_orderId_key"
  ON "ParcelCancellationResolution"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "ParcelCancellationResolution_operationId_key"
  ON "ParcelCancellationResolution"("operationId");
CREATE INDEX IF NOT EXISTS "ParcelCancellationResolution_status_createdAt_idx"
  ON "ParcelCancellationResolution"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ParcelCancellationResolution_paymentId_idx"
  ON "ParcelCancellationResolution"("paymentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParcelCancellationResolution_orderId_fkey'
  ) THEN
    ALTER TABLE "ParcelCancellationResolution"
      ADD CONSTRAINT "ParcelCancellationResolution_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "phase_a_refund_held_account_matches"(
  account_id TEXT,
  customer_id TEXT,
  beneficiary_store_id TEXT,
  payment_id TEXT,
  refund_method TEXT
)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN beneficiary_store_id IS NOT NULL THEN
      customer_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM "LedgerAccount" a
        JOIN "Wallet" w ON w."id" = a."walletId"
        JOIN "Payment" p ON p."id" = payment_id
        JOIN "Order" o ON o."id" = p."orderId"
        WHERE a."id" = account_id
          AND a."purpose" = 'CUSTOMER_REFUND_HELD'
          AND a."category" = 'LIABILITY'
          AND a."currency" = 'ZAR'
          AND NOT a."allowNegative"
          AND w."currency" = 'ZAR'
          AND w."ownerType" = 'STORE'
          AND w."ownerId" = beneficiary_store_id
          AND o."storeId" = beneficiary_store_id
      )
    ELSE
      "phase1_refund_held_account_matches"(account_id, customer_id, payment_id, refund_method)
  END;
$$;

CREATE OR REPLACE FUNCTION "phase15_refund_identity_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'refund evidence cannot be deleted'; END IF;
  IF (NEW."paymentId", NEW."customerUserId", NEW."beneficiaryStoreId", NEW."method", NEW."amount", NEW."currency", NEW."reasonCode", NEW."customerNote", NEW."creationIdempotencyKey", NEW."creationRequestHash", NEW."policyVersion", NEW."reserveLedgerJournalId")
    IS DISTINCT FROM
    (OLD."paymentId", OLD."customerUserId", OLD."beneficiaryStoreId", OLD."method", OLD."amount", OLD."currency", OLD."reasonCode", OLD."customerNote", OLD."creationIdempotencyKey", OLD."creationRequestHash", OLD."policyVersion", OLD."reserveLedgerJournalId")
  THEN RAISE EXCEPTION 'refund financial identity is immutable'; END IF;
  IF OLD."releaseLedgerJournalId" IS NOT NULL AND NEW."releaseLedgerJournalId" IS DISTINCT FROM OLD."releaseLedgerJournalId" THEN RAISE EXCEPTION 'refund release journal is immutable'; END IF;
  IF OLD."completionLedgerJournalId" IS NOT NULL AND NEW."completionLedgerJournalId" IS DISTINCT FROM OLD."completionLedgerJournalId" THEN RAISE EXCEPTION 'refund completion journal is immutable'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "phase15_refund_journal_evidence_check"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."beneficiaryStoreId" IS NOT NULL AND NEW."customerUserId" IS NOT NULL THEN
    RAISE EXCEPTION 'store beneficiary refund must not target a customer personal user id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."reserveLedgerJournalId" AND j."type" = 'REFUND_RESERVE' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (
        SELECT 1 FROM "LedgerEntry" e
        WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount"
          AND "phase_a_refund_held_account_matches"(e."accountId", NEW."customerUserId", NEW."beneficiaryStoreId", NEW."paymentId", NEW."method"::TEXT)
      )
  ) THEN RAISE EXCEPTION 'refund reserve journal evidence is invalid'; END IF;

  IF NEW."releaseLedgerJournalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."releaseLedgerJournalId" AND j."type" = 'REFUND_RELEASE' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (
        SELECT 1 FROM "LedgerEntry" e
        WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount"
          AND "phase_a_refund_held_account_matches"(e."accountId", NEW."customerUserId", NEW."beneficiaryStoreId", NEW."paymentId", NEW."method"::TEXT)
      )
  ) THEN RAISE EXCEPTION 'refund release journal evidence is invalid'; END IF;

  IF NEW."completionLedgerJournalId" IS NOT NULL AND NEW."method" = 'CUSTOMER_WALLET' AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."completionLedgerJournalId" AND j."type" = 'REFUND_WALLET_CREDIT' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (
        SELECT 1 FROM "LedgerEntry" e
        JOIN "LedgerAccount" a ON a."id" = e."accountId"
        JOIN "Wallet" w ON w."id" = a."walletId"
        WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount"
          AND a."purpose" = 'CUSTOMER_REFUND_HELD'
          AND (
            (NEW."beneficiaryStoreId" IS NOT NULL AND w."ownerType" = 'STORE' AND w."ownerId" = NEW."beneficiaryStoreId")
            OR (NEW."beneficiaryStoreId" IS NULL AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
          )
      )
      AND EXISTS (
        SELECT 1 FROM "LedgerEntry" e
        JOIN "LedgerAccount" a ON a."id" = e."accountId"
        JOIN "Wallet" w ON w."id" = a."walletId"
        WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount"
          AND a."category" = 'LIABILITY' AND a."currency" = 'ZAR' AND NOT a."allowNegative"
          AND (
            (NEW."beneficiaryStoreId" IS NOT NULL AND a."purpose" = 'STORE_REFERRAL_WALLET_AVAILABLE' AND w."ownerType" = 'STORE' AND w."ownerId" = NEW."beneficiaryStoreId")
            OR (NEW."beneficiaryStoreId" IS NULL AND a."purpose" = 'CUSTOMER_WALLET_AVAILABLE' AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
          )
      )
  ) THEN RAISE EXCEPTION 'wallet refund completion journal evidence is invalid'; END IF;

  IF NEW."completionLedgerJournalId" IS NOT NULL AND NEW."method" = 'ORIGINAL_PAYMENT_METHOD' AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."completionLedgerJournalId" AND j."type" = 'REFUND_EXTERNAL_PAYOUT' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (
        SELECT 1 FROM "LedgerEntry" e
        WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount"
          AND "phase_a_refund_held_account_matches"(e."accountId", NEW."customerUserId", NEW."beneficiaryStoreId", NEW."paymentId", NEW."method"::TEXT)
      )
      AND EXISTS (
        SELECT 1 FROM "LedgerEntry" e
        JOIN "LedgerAccount" a ON a."id" = e."accountId"
        JOIN "Wallet" w ON w."id" = a."walletId"
        WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount"
          AND a."purpose" = 'CASH_CLEARING' AND a."category" = 'ASSET' AND a."currency" = 'ZAR' AND NOT a."allowNegative" AND w."ownerType" = 'PLATFORM'
      )
  ) THEN RAISE EXCEPTION 'external refund completion journal evidence is invalid'; END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;
