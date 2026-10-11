-- Match the canonical ledger normalization: source references are uppercase, operation IDs retain exact case.
CREATE OR REPLACE FUNCTION "store_earning_bounded_adjustment_guard"() RETURNS TRIGGER AS $$
DECLARE evidence RECORD;
DECLARE cumulative NUMERIC := 0;
BEGIN
  IF NEW."reversedAmount" = 0 OR NEW."reversalLedgerJournalId" IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW."subjectType" <> 'MARKETPLACE_ORDER' OR NEW."status" NOT IN ('ACCRUED', 'RECONCILIATION_REQUIRED', 'RELEASED') THEN
    RAISE EXCEPTION 'bounded store earning reversal status is invalid';
  END IF;
  FOR evidence IN
    SELECT j.* FROM "LedgerJournal" j
    WHERE j."type" = 'STORE_EARNING_REVERSAL'
      AND j."metadata"->>'earningReference' = NEW."publicReference"
      AND j."metadata"->>'operationId' IS NOT NULL
    ORDER BY (j."metadata"->'frozenAdjustmentEvidence'->>'previouslyAdjustedAmount')::NUMERIC, j."id"
  LOOP
    IF evidence."currency" <> 'ZAR' OR evidence."totalDebits" <= 0 OR evidence."totalDebits" <> evidence."totalCredits"
      OR evidence."metadata"->>'storeReference' IS DISTINCT FROM NEW."storePublicReference"
      OR evidence."metadata"->>'subjectReference' IS DISTINCT FROM NEW."subjectPublicReference"
      OR evidence."metadata"->>'settlementVersion' IS DISTINCT FROM NEW."settlementVersion"
      OR evidence."metadata"->>'reasonCode' IS DISTINCT FROM 'MARKETPLACE_STORE_ADJUSTMENT'
      OR evidence."metadata"->>'operationId' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$'
      OR evidence."idempotencyKey" IS DISTINCT FROM 'store-earning:' || NEW."publicReference" || ':adjust:' || (evidence."metadata"->>'operationId')
      OR evidence."sourceReference" IS DISTINCT FROM UPPER(evidence."idempotencyKey")
      OR (evidence."metadata"->'frozenAdjustmentEvidence'->>'originalAmount')::NUMERIC IS DISTINCT FROM NEW."amount"
      OR (evidence."metadata"->'frozenAdjustmentEvidence'->>'originalSellerBasis')::NUMERIC IS DISTINCT FROM NEW."settlementBasisAmount"
      OR (evidence."metadata"->'frozenAdjustmentEvidence'->>'originalCommission')::NUMERIC IS DISTINCT FROM NEW."attributedCommissionAmount"
      OR (evidence."metadata"->'frozenAdjustmentEvidence'->>'previouslyAdjustedAmount')::NUMERIC IS DISTINCT FROM cumulative
      OR (SELECT COUNT(*) FROM "LedgerEntry" e WHERE e."journalId" = evidence."id") <> 2
      OR NOT EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId" = evidence."id" AND e."direction" = 'DEBIT' AND e."accountId" = NEW."payableAccountId" AND e."amount" = evidence."totalDebits" AND e."lineCode" = 'STORE_EARNINGS_PAYABLE')
      OR NOT EXISTS (
        SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId"
        WHERE e."journalId" = evidence."id" AND e."direction" = 'CREDIT' AND e."amount" = evidence."totalCredits" AND e."lineCode" = 'CUSTOMER_FUNDS_HELD'
          AND a."purpose" = 'HELD' AND a."category" = 'LIABILITY' AND a."currency" = 'ZAR' AND NOT a."allowNegative"
          AND w."ownerType" = 'PLATFORM' AND w."ownerId" = 'platform' AND w."currency" = 'ZAR'
      ) THEN RAISE EXCEPTION 'bounded store earning reversal journal chain is invalid'; END IF;
    cumulative := cumulative + evidence."totalDebits";
  END LOOP;
  IF cumulative <> NEW."reversedAmount" THEN RAISE EXCEPTION 'store earning reversal projection requires exact immutable journal evidence'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

