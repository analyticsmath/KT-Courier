-- Gate 4 refund concurrency fix: preserve payment identity/success immutability
-- while allowing post-success refund projection updates and version increments.
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
     AND (to_jsonb(OLD) - 'reconciliationStatus' - 'updatedAt' - 'totalRefundedAmount' - 'totalRefundReservedAmount' - 'version')
         IS DISTINCT FROM (to_jsonb(NEW) - 'reconciliationStatus' - 'updatedAt' - 'totalRefundedAmount' - 'totalRefundReservedAmount' - 'version') THEN
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
