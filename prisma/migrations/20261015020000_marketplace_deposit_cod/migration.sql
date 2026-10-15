-- Existing purchases remain fully digital. New reviews freeze the real provider
-- allocation separately from the total commercial value. No policy is activated.
ALTER TABLE "MarketplaceCheckout" ADD COLUMN "digitalRequired" DECIMAL(18,2), ADD COLUMN "cashRequired" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "digitalRequired" DECIMAL(18,2) NOT NULL DEFAULT 0, ADD COLUMN "cashRequired" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "MarketplaceCheckoutStoreGroup" ADD COLUMN "paymentPlan" JSONB;
UPDATE "MarketplaceCheckout" SET "digitalRequired" = "grandTotal";
UPDATE "MarketplaceOrder" SET "digitalRequired" = "grandTotal";
ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_payment_split" CHECK ("cashRequired" >= 0 AND ("digitalRequired" IS NULL AND "cashRequired" = 0 OR "digitalRequired" >= 0 AND "digitalRequired" + "cashRequired" = "grandTotal"));
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_payment_split" CHECK ("digitalRequired" >= 0 AND "cashRequired" >= 0 AND "digitalRequired" + "cashRequired" = "grandTotal");

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
           AND o."digitalRequired" = OLD."amount"
           AND o."digitalRequired" + o."cashRequired" = o."grandTotal"
           AND EXISTS (SELECT 1 FROM "MarketplaceCheckout" c WHERE c."id" = o."checkoutId" AND COALESCE(c."digitalRequired", c."grandTotal") = o."digitalRequired" AND c."cashRequired" = o."cashRequired" AND c."acceptedFingerprint" = o."commercialFingerprint")
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

-- A payment plan is part of customer-accepted commercial evidence. Once a
-- payment exists, changing it cannot silently change the charge or cash due.
CREATE FUNCTION "marketplace_payment_plan_immutable"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME = 'MarketplaceCheckoutStoreGroup' THEN
   IF (OLD."paymentPlan", OLD."groupTotal", OLD."fulfilmentMode") IS DISTINCT FROM (NEW."paymentPlan", NEW."groupTotal", NEW."fulfilmentMode") AND EXISTS (SELECT 1 FROM "Payment" WHERE "marketplaceCheckoutId" = OLD."checkoutId") THEN
     RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Committed marketplace group payment plan is immutable.';
   END IF;
 ELSIF TG_TABLE_NAME = 'MarketplaceCheckout' THEN
   IF (OLD."digitalRequired", OLD."cashRequired", OLD."grandTotal", OLD."acceptedFingerprint") IS DISTINCT FROM (NEW."digitalRequired", NEW."cashRequired", NEW."grandTotal", NEW."acceptedFingerprint") AND EXISTS (SELECT 1 FROM "Payment" WHERE "marketplaceCheckoutId" = OLD."id") THEN
     RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Committed marketplace checkout payment split is immutable.';
   END IF;
 ELSE
   IF (OLD."digitalRequired", OLD."cashRequired", OLD."grandTotal", OLD."paymentId", OLD."checkoutId", OLD."commercialFingerprint") IS DISTINCT FROM (NEW."digitalRequired", NEW."cashRequired", NEW."grandTotal", NEW."paymentId", NEW."checkoutId", NEW."commercialFingerprint") THEN
     RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Marketplace order payment split is immutable.';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MarketplaceCheckoutStoreGroup_payment_plan_immutable" BEFORE UPDATE ON "MarketplaceCheckoutStoreGroup" FOR EACH ROW EXECUTE FUNCTION "marketplace_payment_plan_immutable"();
CREATE TRIGGER "MarketplaceCheckout_payment_plan_immutable" BEFORE UPDATE ON "MarketplaceCheckout" FOR EACH ROW EXECUTE FUNCTION "marketplace_payment_plan_immutable"();
CREATE TRIGGER "MarketplaceOrder_payment_plan_immutable" BEFORE UPDATE ON "MarketplaceOrder" FOR EACH ROW EXECUTE FUNCTION "marketplace_payment_plan_immutable"();

-- Older canonical digital producers omit the newly introduced allocation.
-- Preserve their exact fully prepaid behavior without inventing any cash.
CREATE FUNCTION "marketplace_legacy_digital_order_default"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."digitalRequired" = 0 AND NEW."cashRequired" = 0 THEN NEW."digitalRequired" := NEW."grandTotal"; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MarketplaceOrder_legacy_digital_default" BEFORE INSERT ON "MarketplaceOrder" FOR EACH ROW EXECUTE FUNCTION "marketplace_legacy_digital_order_default"();
CREATE FUNCTION "marketplace_committed_group_delete_guard"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "Payment" WHERE "marketplaceCheckoutId" = OLD."checkoutId") THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Committed marketplace group cannot be removed.';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER "MarketplaceCheckoutStoreGroup_payment_plan_delete_guard" BEFORE DELETE ON "MarketplaceCheckoutStoreGroup" FOR EACH ROW EXECUTE FUNCTION "marketplace_committed_group_delete_guard"();
CREATE FUNCTION "cod_funded_obligation_immutable"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."digitalPaid" > 0 AND (OLD."orderId", OLD."paymentId", OLD."policyMode", OLD."currency", OLD."authoritativePayable", OLD."digitalRequired", OLD."digitalPaid", OLD."cashObligation") IS DISTINCT FROM (NEW."orderId", NEW."paymentId", NEW."policyMode", NEW."currency", NEW."authoritativePayable", NEW."digitalRequired", NEW."digitalPaid", NEW."cashObligation") THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Funded COD source obligation is immutable.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "CashOnDelivery_funded_obligation_immutable" BEFORE UPDATE ON "CashOnDelivery" FOR EACH ROW EXECUTE FUNCTION "cod_funded_obligation_immutable"();
