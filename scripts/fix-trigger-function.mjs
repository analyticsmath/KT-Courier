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

const sqlPaymentIdentity = `
CREATE OR REPLACE FUNCTION "protect_payment_identity_and_success"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."latestAttemptNumber" < OLD."latestAttemptNumber" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment attempt counter cannot decrease.';
  END IF;
  IF OLD."status" IS DISTINCT FROM NEW."status" AND NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment version must increase with every state change.';
  END IF;
  IF OLD."status"::text = 'SUCCEEDED'
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
`;

async function main() {
  for (const db of dbNames) {
    const prisma = new PrismaClient({
      datasources: { db: { url: `postgresql://postgres:postgres@localhost:5433/${db}?schema=public` } }
    });
    try {
      await prisma.$executeRawUnsafe(sql);
      await prisma.$executeRawUnsafe(sqlPaymentIdentity);
      console.log(`Updated triggers on database ${db}`);
    } catch (e) {
      console.log(`Skipped ${db} (${e.message})`);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch(err => console.error(err));
