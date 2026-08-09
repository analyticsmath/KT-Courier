-- Gate 3 schema-drift reconciliation.
--
-- The current application schema is authoritative for the active runtime
-- contract. This forward-only migration closes the behavioural gaps left by
-- the accepted historical chain. Name-only differences are represented with
-- Prisma relation/index mappings instead of rebuilding valid database objects.
--
-- Deployment preflight: run `npm run db:preflight:schema-drift` before this
-- migration on any populated environment. It fails closed for provider-event,
-- subscription-cycle, recruitment-ownership, and catalogue-reference conflicts.

-- DispatchCandidateEvidence.orderId is a read projection of the canonical
-- DispatchCandidateEvaluation.courierOrderId; it is not a second assignment or
-- courier-order authority. Existing evidence is deterministically backfilled
-- from its required evaluation before the new FK/index are introduced.
ALTER TABLE "DispatchCandidateEvidence" ADD COLUMN "orderId" TEXT;

UPDATE "DispatchCandidateEvidence" AS evidence
SET "orderId" = evaluation."courierOrderId"
FROM "DispatchCandidateEvaluation" AS evaluation
WHERE evaluation."id" = evidence."evaluationId"
  AND evidence."orderId" IS NULL;

DO $$
DECLARE
  invalid_dispatch_evidence_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO invalid_dispatch_evidence_count
  FROM "DispatchCandidateEvidence" AS evidence
  LEFT JOIN "DispatchCandidateEvaluation" AS evaluation
    ON evaluation."id" = evidence."evaluationId"
  LEFT JOIN "Order" AS courier_order
    ON courier_order."id" = evidence."orderId"
  WHERE evaluation."id" IS NULL
     OR evidence."orderId" IS NULL
     OR evidence."orderId" <> evaluation."courierOrderId"
     OR courier_order."id" IS NULL;

  IF invalid_dispatch_evidence_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Schema drift reconciliation blocked: DispatchCandidateEvidence order projection is missing, orphaned, or conflicts with its canonical evaluation order.';
  END IF;
END $$;

ALTER TABLE "DispatchCandidateEvidence"
  ADD CONSTRAINT "DispatchCandidateEvidence_order_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DispatchCandidateEvidence_order_created_idx"
  ON "DispatchCandidateEvidence"("orderId", "createdAt");

-- Promoter qualification and earning amounts are exact-money values. The
-- only platform ledger currency accepted by the established financial model is
-- ZAR, so existing rows are backfilled explicitly rather than receiving an
-- implicit required-column default.
ALTER TABLE "PromoterQualification" ADD COLUMN "currency" "LedgerCurrency";
ALTER TABLE "PromoterEarning" ADD COLUMN "currency" "LedgerCurrency";

UPDATE "PromoterQualification"
SET "currency" = 'ZAR'
WHERE "currency" IS NULL;

UPDATE "PromoterEarning"
SET "currency" = 'ZAR'
WHERE "currency" IS NULL;

DO $$
DECLARE
  invalid_currency_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO invalid_currency_count
  FROM (
    SELECT 1
    FROM "PromoterQualification"
    WHERE "currency" IS NULL OR "currency" <> 'ZAR'
    UNION ALL
    SELECT 1
    FROM "PromoterEarning"
    WHERE "currency" IS NULL OR "currency" <> 'ZAR'
  ) AS invalid_currency;

  IF invalid_currency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Schema drift reconciliation blocked: promoter financial rows must use the canonical ZAR ledger currency before NOT NULL enforcement.';
  END IF;
END $$;

ALTER TABLE "PromoterQualification"
  ALTER COLUMN "currency" SET DEFAULT 'ZAR',
  ALTER COLUMN "currency" SET NOT NULL;

ALTER TABLE "PromoterEarning"
  ALTER COLUMN "currency" SET DEFAULT 'ZAR',
  ALTER COLUMN "currency" SET NOT NULL;

-- The active Prisma contract correctly protects ledger evidence from deletion.
-- The Phase 24 nullable journal references used SET NULL; they are replaced
-- only after an orphan preflight so historical financial/audit facts cannot be
-- silently detached from their journals.
DO $$
DECLARE
  orphaned_financial_journal_reference_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO orphaned_financial_journal_reference_count
  FROM (
    SELECT 1
    FROM "AdvertisingFundingMovement" AS movement
    LEFT JOIN "LedgerJournal" AS journal ON journal."id" = movement."ledgerJournalId"
    WHERE movement."ledgerJournalId" IS NOT NULL AND journal."id" IS NULL
    UNION ALL
    SELECT 1
    FROM "AdvertisingClickCharge" AS charge
    LEFT JOIN "LedgerJournal" AS journal ON journal."id" = charge."ledgerJournalId"
    WHERE charge."ledgerJournalId" IS NOT NULL AND journal."id" IS NULL
    UNION ALL
    SELECT 1
    FROM "AdvertisingClickCharge" AS charge
    LEFT JOIN "LedgerJournal" AS journal ON journal."id" = charge."reversedByJournalId"
    WHERE charge."reversedByJournalId" IS NOT NULL AND journal."id" IS NULL
  ) AS orphaned_reference;

  IF orphaned_financial_journal_reference_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Schema drift reconciliation blocked: advertising financial evidence contains orphaned ledger-journal references.';
  END IF;
END $$;

ALTER TABLE "AdvertisingFundingMovement"
  DROP CONSTRAINT "AdvertisingFundingMovement_ledgerJournalId_fkey";
ALTER TABLE "AdvertisingFundingMovement"
  ADD CONSTRAINT "AdvertisingFundingMovement_ledgerJournalId_fkey"
  FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvertisingClickCharge"
  DROP CONSTRAINT "AdvertisingClickCharge_ledgerJournalId_fkey";
ALTER TABLE "AdvertisingClickCharge"
  ADD CONSTRAINT "AdvertisingClickCharge_ledgerJournalId_fkey"
  FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvertisingClickCharge"
  DROP CONSTRAINT "AdvertisingClickCharge_reversedByJournalId_fkey";
ALTER TABLE "AdvertisingClickCharge"
  ADD CONSTRAINT "AdvertisingClickCharge_reversedByJournalId_fkey"
  FOREIGN KEY ("reversedByJournalId") REFERENCES "LedgerJournal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
