-- Phase B reconciliation: successful demo attempts already have a verified
-- payment, webhook and posted journal. The legacy seed omitted completedAt.
UPDATE "PaymentAttempt" a
SET "completedAt" = COALESCE(p."paidAt", a."createdAt")
FROM "Payment" p
WHERE a."paymentId" = p."id"
  AND a."status" = 'SUCCEEDED'
  AND a."completedAt" IS NULL
  AND p."status" = 'SUCCEEDED'
  AND p."successfulAttemptId" = a."id"
  AND p."successWebhookEventId" IS NOT NULL
  AND p."successLedgerJournalId" IS NOT NULL;
