-- A verified payment is committed before its canonical marketplace finalizer
-- creates the order. Permit only that first coherent reverse association.
-- Financial/source/success evidence and established order identity stay immutable.
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
     AND OLD."marketplaceOrderId" IS DISTINCT FROM NEW."marketplaceOrderId" THEN
    IF OLD."marketplaceOrderId" IS NOT NULL OR NEW."marketplaceOrderId" IS NULL
       OR OLD."subjectType"::text <> 'MARKETPLACE_CHECKOUT'
       OR OLD."marketplaceCheckoutId" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM "MarketplaceOrder" o
         WHERE o."id" = NEW."marketplaceOrderId"
           AND o."paymentId" = OLD."id"
           AND o."checkoutId" = OLD."marketplaceCheckoutId"
           AND o."currency"::text = OLD."currency"::text
           AND o."grandTotal" = OLD."amount"
           AND o."customerUserId" IS NOT DISTINCT FROM OLD."userId"
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Established or incoherent marketplace payment order binding is immutable.';
    END IF;
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
