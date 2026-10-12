-- Forward-only repair. Historical customer evidence and journal hashes remain
-- unchanged. Guests may use only the dedicated original-payment liability,
-- backed by the payment's applied signed webhook and verified successful attempt.
CREATE FUNCTION "phase1_refund_held_account_matches"(account_id TEXT, customer_id TEXT, payment_id TEXT, refund_method TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM "LedgerAccount" a JOIN "Wallet" w ON w."id" = a."walletId"
    WHERE a."id" = account_id AND a."purpose" = 'CUSTOMER_REFUND_HELD'
      AND a."category" = 'LIABILITY' AND a."currency" = 'ZAR' AND NOT a."allowNegative"
      AND w."currency" = 'ZAR'
      AND (
        (customer_id IS NOT NULL AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = customer_id)
        OR (
          customer_id IS NULL AND refund_method = 'ORIGINAL_PAYMENT_METHOD'
          AND a."code" = 'PLATFORM-GUEST-REFUND-HELD-ZAR'
          AND w."ownerType" = 'PLATFORM' AND w."ownerId" = 'platform'
          AND EXISTS (
            SELECT 1 FROM "Payment" p
            JOIN "PaymentAttempt" pa ON pa."id" = p."successfulAttemptId" AND pa."paymentId" = p."id"
            JOIN "PaymentWebhookEvent" pe ON pe."id" = p."successWebhookEventId" AND pe."paymentId" = p."id" AND pe."attemptId" = pa."id"
            JOIN "LedgerJournal" pj ON pj."id" = p."successLedgerJournalId" AND pe."ledgerJournalId" = pj."id"
            WHERE p."id" = payment_id AND p."userId" IS NULL AND p."subjectType" = 'MARKETPLACE_CHECKOUT'
              AND p."status" = 'SUCCEEDED' AND p."currency" = 'ZAR' AND pa."status" = 'SUCCEEDED'
              AND pa."providerReference" IS NOT NULL AND pe."itnProcessingStatus" = 'APPLIED'
              AND pe."signatureVerified" AND pe."merchantVerified" AND pe."amountVerified" AND pe."providerDataVerified"
              AND pj."currency" = 'ZAR' AND pj."totalDebits" = p."amount" AND pj."totalCredits" = p."amount"
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION "phase15_refund_journal_evidence_check"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."reserveLedgerJournalId" AND j."type" = 'REFUND_RESERVE' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount" AND "phase1_refund_held_account_matches"(e."accountId", NEW."customerUserId", NEW."paymentId", NEW."method"::TEXT))
  ) THEN RAISE EXCEPTION 'refund reserve journal evidence is invalid'; END IF;

  IF NEW."releaseLedgerJournalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."releaseLedgerJournalId" AND j."type" = 'REFUND_RELEASE' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount" AND "phase1_refund_held_account_matches"(e."accountId", NEW."customerUserId", NEW."paymentId", NEW."method"::TEXT))
  ) THEN RAISE EXCEPTION 'refund release journal evidence is invalid'; END IF;

  IF NEW."completionLedgerJournalId" IS NOT NULL AND NEW."method" = 'CUSTOMER_WALLET' AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."completionLedgerJournalId" AND j."type" = 'REFUND_WALLET_CREDIT' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CUSTOMER_REFUND_HELD' AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CUSTOMER_WALLET_AVAILABLE' AND a."category" = 'LIABILITY' AND a."currency" = 'ZAR' AND NOT a."allowNegative" AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
  ) THEN RAISE EXCEPTION 'wallet refund completion journal evidence is invalid'; END IF;

  IF NEW."completionLedgerJournalId" IS NOT NULL AND NEW."method" = 'ORIGINAL_PAYMENT_METHOD' AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."completionLedgerJournalId" AND j."type" = 'REFUND_EXTERNAL_PAYOUT' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount" AND "phase1_refund_held_account_matches"(e."accountId", NEW."customerUserId", NEW."paymentId", NEW."method"::TEXT))
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CASH_CLEARING' AND a."category" = 'ASSET' AND a."currency" = 'ZAR' AND NOT a."allowNegative" AND w."ownerType" = 'PLATFORM')
  ) THEN RAISE EXCEPTION 'external refund completion journal evidence is invalid'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
