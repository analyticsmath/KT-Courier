-- Allow internal full-wallet payments (provider = 'MANUAL') in Payment_success_evidence_coherence_check,
-- matching Payment_succeeded_requires_provider_evidence_check and validate_payment_success_evidence().

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_success_evidence_coherence_check";

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
      "provider" = 'MANUAL'
      AND "status" = 'SUCCEEDED'
      AND "successfulAttemptId" IS NULL
      AND "successWebhookEventId" IS NULL
      AND "successLedgerJournalId" IS NOT NULL
      AND "providerConfirmedAt" IS NULL
      AND "paidAt" IS NOT NULL
    )
  );
