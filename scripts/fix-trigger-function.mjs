import { PrismaClient } from '@prisma/client';

const dbNames = [
  'kt_courier_dev',
  'kt_courier_phase265_clean',
  'kt_courier_phase265_incremental',
  'kt_courier_phase265_integration',
  'kt_courier_phase265_concurrency',
  'kt_courier_phase265_e2e',
];

const sql = `
CREATE OR REPLACE FUNCTION "validate_payment_success_evidence"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."successfulAttemptId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PaymentAttempt" a
    WHERE a."id" = NEW."successfulAttemptId"
      AND a."paymentId" = NEW."id"
      AND a."status"::text = 'SUCCEEDED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment success attempt evidence is incoherent.';
  END IF;
  IF NEW."successWebhookEventId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PaymentWebhookEvent" e
    WHERE e."id" = NEW."successWebhookEventId"
      AND e."paymentId" = NEW."id"
      AND e."normalizedStatus" = 'COMPLETE'
      AND e."providerDataVerified"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment success webhook evidence is incoherent.';
  END IF;
  IF NEW."successLedgerJournalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "LedgerJournal" j
    JOIN "PaymentWebhookEvent" e ON e."id" = NEW."successWebhookEventId"
    WHERE j."id" = NEW."successLedgerJournalId"
      AND j."type"::text = 'EXTERNAL_PAYMENT_RECEIPT'
      AND j."currency"::text = 'ZAR'
      AND j."correlationId" = NEW."paymentNumber"
      AND j."totalDebits" = NEW."amount"
      AND j."totalCredits" = NEW."amount"
      AND e."ledgerJournalId" = j."id"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment success journal evidence is incoherent.';
  END IF;
  RETURN NEW;
END $$;
`;

async function main() {
  for (const db of dbNames) {
    const prisma = new PrismaClient({
      datasources: { db: { url: `postgresql://postgres:postgres@localhost:5433/${db}?schema=public` } }
    });
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`Updated validate_payment_success_evidence on database ${db}`);
    } catch (e) {
      console.log(`Skipped ${db} (${e.message})`);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch(err => console.error(err));
