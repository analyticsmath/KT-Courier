-- Support Paystack Verify API authoritative settlement (verifiedVia = 'PAYSTACK_VERIFY_API')
-- without forging synthetic PaymentWebhookEvent records, while preserving strict
-- attempt, provider reference, and EXTERNAL_PAYMENT_RECEIPT ledger evidence, plus
-- one-time late signed-webhook linkage.

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_success_evidence_coherence_check";

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_success_evidence_coherence_check"
  CHECK (
    (
      "successfulAttemptId" IS NULL
      AND "successWebhookEventId" IS NULL
      AND "successLedgerJournalId" IS NULL
      AND "providerConfirmedAt" IS NULL
    )
    OR (
      "provider" IS DISTINCT FROM 'MANUAL'
      AND "successfulAttemptId" IS NOT NULL
      AND "successWebhookEventId" IS NOT NULL
      AND "successLedgerJournalId" IS NOT NULL
      AND "providerConfirmedAt" IS NOT NULL
    )
    OR (
      "provider" = 'PAYSTACK'
      AND "status" = 'SUCCEEDED'
      AND "successfulAttemptId" IS NOT NULL
      AND "successWebhookEventId" IS NULL
      AND "successLedgerJournalId" IS NOT NULL
      AND "providerConfirmedAt" IS NOT NULL
      AND ("metadata"->>'verifiedVia') = 'PAYSTACK_VERIFY_API'
    )
    OR (
      "provider" = 'MANUAL'
      AND "status" = 'SUCCEEDED'
      AND "successfulAttemptId" IS NULL
      AND "successWebhookEventId" IS NULL
      AND "successLedgerJournalId" IS NOT NULL
      AND "providerConfirmedAt" IS NULL
      AND "paidAt" IS NOT NULL
    )
  );

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_succeeded_requires_provider_evidence_check";

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_succeeded_requires_provider_evidence_check"
  CHECK (
    (
      "status" = 'SUCCEEDED'
      AND (
        (
          "provider" IS DISTINCT FROM 'MANUAL'
          AND "successfulAttemptId" IS NOT NULL
          AND "successWebhookEventId" IS NOT NULL
          AND "successLedgerJournalId" IS NOT NULL
          AND "providerConfirmedAt" IS NOT NULL
        )
        OR (
          "provider" = 'PAYSTACK'
          AND "successfulAttemptId" IS NOT NULL
          AND "successWebhookEventId" IS NULL
          AND "successLedgerJournalId" IS NOT NULL
          AND "providerConfirmedAt" IS NOT NULL
          AND ("metadata"->>'verifiedVia') = 'PAYSTACK_VERIFY_API'
        )
        OR (
          "provider" = 'MANUAL'
          AND "successfulAttemptId" IS NULL
          AND "successWebhookEventId" IS NULL
          AND "successLedgerJournalId" IS NOT NULL
          AND "paidAt" IS NOT NULL
        )
      )
    )
    OR (
      "status" <> 'SUCCEEDED'
      AND "successfulAttemptId" IS NULL
      AND "successWebhookEventId" IS NULL
      AND "successLedgerJournalId" IS NULL
      AND "providerConfirmedAt" IS NULL
    )
  );

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

  -- Authoritative Paystack Verify API settlement when signed webhook has not yet arrived
  IF NEW."provider"::text = 'PAYSTACK'
     AND NEW."successWebhookEventId" IS NULL
     AND COALESCE(NEW."metadata"->>'verifiedVia', '') = 'PAYSTACK_VERIFY_API' THEN
    IF NEW."providerConfirmedAt" IS NULL
       OR NEW."paidAt" IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM "PaymentAttempt" a
         WHERE a."id" = NEW."successfulAttemptId"
           AND a."paymentId" = NEW."id"
           AND a."provider"::text = 'PAYSTACK'
           AND a."status"::text = 'SUCCEEDED'
           AND NULLIF(btrim(COALESCE(a."providerReference", '')), '') IS NOT NULL
       )
       OR NOT EXISTS (
         SELECT 1
         FROM "LedgerJournal" j
         WHERE j."id" = NEW."successLedgerJournalId"
           AND j."type"::text = 'EXTERNAL_PAYMENT_RECEIPT'
           AND j."currency"::text = NEW."currency"::text
           AND j."correlationId" = NEW."paymentNumber"
           AND j."totalDebits" = NEW."amount"
           AND j."totalCredits" = NEW."amount"
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded Paystack Verify payment requires coherent succeeded attempt, provider reference, and receipt ledger evidence.';
    END IF;

    RETURN NEW;
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

CREATE OR REPLACE FUNCTION "protect_payment_identity_and_success"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  wallet_split_amount NUMERIC(18,2);
BEGIN
  IF NEW."latestAttemptNumber" < OLD."latestAttemptNumber" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment attempt counter cannot decrease.';
  END IF;
  IF OLD."status" IS DISTINCT FROM NEW."status" AND NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment version must increase with every state change.';
  END IF;
  IF OLD."status"::text = 'SUCCEEDED'
     AND OLD."marketplaceOrderId" IS DISTINCT FROM NEW."marketplaceOrderId" THEN
    wallet_split_amount := COALESCE(
      CASE
        WHEN jsonb_typeof(OLD."metadata"->'walletAmount') = 'string'
             AND (OLD."metadata"->>'walletAmount') ~ '^(?:0|[1-9][0-9]*)\.[0-9]{2}$'
        THEN (OLD."metadata"->>'walletAmount')::numeric(18,2)
        ELSE 0
      END,
      0
    );
    IF OLD."marketplaceOrderId" IS NOT NULL OR NEW."marketplaceOrderId" IS NULL
       OR OLD."subjectType"::text <> 'MARKETPLACE_CHECKOUT'
       OR OLD."marketplaceCheckoutId" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM "MarketplaceOrder" o
         WHERE o."id" = NEW."marketplaceOrderId"
           AND o."paymentId" = OLD."id"
           AND o."checkoutId" = OLD."marketplaceCheckoutId"
           AND o."currency"::text = OLD."currency"::text
           AND (o."digitalRequired" = OLD."amount" OR o."digitalRequired" = OLD."amount" + wallet_split_amount)
           AND o."digitalRequired" + o."cashRequired" = o."grandTotal"
           AND EXISTS (SELECT 1 FROM "MarketplaceCheckout" c WHERE c."id" = o."checkoutId" AND COALESCE(c."digitalRequired", c."grandTotal") = o."digitalRequired" AND c."cashRequired" = o."cashRequired" AND c."acceptedFingerprint" = o."commercialFingerprint")
           AND o."customerUserId" IS NOT DISTINCT FROM OLD."userId"
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Established or incoherent marketplace payment order binding is immutable.';
    END IF;
  END IF;
  IF OLD."status"::text = 'SUCCEEDED'
     AND OLD."successWebhookEventId" IS NULL
     AND NEW."successWebhookEventId" IS NOT NULL
     AND OLD."provider"::text = 'PAYSTACK'
     AND COALESCE(OLD."metadata"->>'verifiedVia', '') = 'PAYSTACK_VERIFY_API' THEN
    IF (to_jsonb(OLD) - 'reconciliationStatus' - 'updatedAt' - 'totalRefundedAmount' - 'totalRefundReservedAmount' - 'version' - 'marketplaceOrderId' - 'successWebhookEventId')
       IS DISTINCT FROM (to_jsonb(NEW) - 'reconciliationStatus' - 'updatedAt' - 'totalRefundedAmount' - 'totalRefundReservedAmount' - 'version' - 'marketplaceOrderId' - 'successWebhookEventId') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded payment evidence is immutable.';
    END IF;
  ELSIF OLD."status"::text = 'SUCCEEDED'
     AND (to_jsonb(OLD) - 'reconciliationStatus' - 'updatedAt' - 'totalRefundedAmount' - 'totalRefundReservedAmount' - 'version' - 'marketplaceOrderId')
         IS DISTINCT FROM (to_jsonb(NEW) - 'reconciliationStatus' - 'updatedAt' - 'totalRefundedAmount' - 'totalRefundReservedAmount' - 'version' - 'marketplaceOrderId') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded payment evidence is immutable.';
  END IF;
  IF EXISTS (SELECT 1 FROM "PaymentAttempt" WHERE "paymentId" = OLD."id")
     AND (
       OLD."amount" IS DISTINCT FROM NEW."amount"
       OR OLD."currency" IS DISTINCT FROM NEW."currency"
       OR OLD."orderId" IS DISTINCT FROM NEW."orderId"
       OR OLD."userId" IS DISTINCT FROM NEW."userId"
       OR OLD."provider" IS DISTINCT FROM NEW."provider"
       OR OLD."purpose" IS DISTINCT FROM NEW."purpose"
       OR OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey"
       OR OLD."creationRequestHash" IS DISTINCT FROM NEW."creationRequestHash"
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment financial and subject identity is immutable after an attempt exists.';
  END IF;
  RETURN NEW;
END $$;
