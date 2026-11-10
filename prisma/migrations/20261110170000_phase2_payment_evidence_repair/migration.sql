-- Phase 2 Repair: Correct column references in validate_payment_success_evidence()
-- Replacing invalid columns (paymentAttemptId, signatureStatus, etc.) with canonical
-- schema columns (attemptId, providerDataVerified) and preserving strict internal
-- wallet ledger validation and external provider attempt/webhook/journal validation.

CREATE OR REPLACE FUNCTION "validate_payment_success_evidence"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" <> 'SUCCEEDED' THEN
    RETURN NEW;
  END IF;

  IF NEW."provider" = 'MANUAL' THEN
    IF NEW."successfulAttemptId" IS NOT NULL
       OR NEW."successWebhookEventId" IS NOT NULL
       OR NEW."successLedgerJournalId" IS NULL
       OR NEW."paidAt" IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded internal wallet payment has invalid evidence pointers.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM "LedgerJournal" j
      WHERE j."id" = NEW."successLedgerJournalId"
        AND j."type" = 'ACCOUNT_TRANSFER'
        AND j."currency"::text = NEW."currency"::text
        AND j."totalDebits" = NEW."amount"
        AND j."totalCredits" = NEW."amount"
        AND j."correlationId" = NEW."paymentNumber"
        AND EXISTS (
          SELECT 1
          FROM "LedgerEntry" e
          JOIN "LedgerAccount" a ON a."id" = e."accountId"
          JOIN "Wallet" w ON w."id" = a."walletId"
          WHERE e."journalId" = j."id"
            AND e."direction" = 'CREDIT'
            AND e."amount" = NEW."amount"
            AND a."purpose" = 'HELD'
            AND w."ownerType" = 'PLATFORM'
        )
        AND EXISTS (
          SELECT 1
          FROM "LedgerEntry" e
          JOIN "LedgerAccount" a ON a."id" = e."accountId"
          JOIN "Wallet" w ON w."id" = a."walletId"
          WHERE e."journalId" = j."id"
            AND e."direction" = 'DEBIT'
            AND e."amount" = NEW."amount"
            AND a."category" = 'LIABILITY'
            AND w."ownerType" IN ('CUSTOMER', 'STORE')
            AND a."purpose" IN ('CUSTOMER_WALLET_AVAILABLE', 'STORE_REFERRAL_WALLET_AVAILABLE', 'STORE_EARNINGS_PAYABLE', 'HELD', 'AVAILABLE')
        )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded internal wallet payment requires coherent wallet transfer ledger evidence.';
    END IF;

    RETURN NEW;
  END IF;

  -- External provider payment (PAYSTACK, PAYFAST, etc.)
  IF NOT EXISTS (
    SELECT 1
    FROM "PaymentAttempt" a
    WHERE a."id" = NEW."successfulAttemptId"
      AND a."paymentId" = NEW."id"
      AND a."status"::text = 'SUCCEEDED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded payment requires a matching succeeded payment attempt.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "PaymentWebhookEvent" w
    JOIN "LedgerJournal" j ON j."id" = w."ledgerJournalId"
    WHERE w."id" = NEW."successWebhookEventId"
      AND w."paymentId" = NEW."id"
      AND (w."attemptId" = NEW."successfulAttemptId" OR w."attemptId" IS NULL)
      AND w."ledgerJournalId" = NEW."successLedgerJournalId"
      AND w."providerDataVerified" = true
      AND j."type"::text = 'EXTERNAL_PAYMENT_RECEIPT'
      AND j."currency"::text = NEW."currency"::text
      AND j."correlationId" = NEW."paymentNumber"
      AND j."totalDebits" = NEW."amount"
      AND j."totalCredits" = NEW."amount"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded payment requires coherent verified webhook and ledger evidence.';
  END IF;

  RETURN NEW;
END $$;
