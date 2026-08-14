-- Phase B: reconcile Payment's physical subject guard with the current
-- application policy. Each PaymentSubjectType has exactly one canonical
-- business relation; marketplace lifecycle projections remain constrained to
-- the checkout that owns them.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_subject_shape_check";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subject_shape_check" CHECK (
  (
    "subjectType" = 'COURIER_ORDER'
    AND "orderId" IS NOT NULL AND "userId" IS NOT NULL
    AND "marketplaceCheckoutId" IS NULL AND "marketplaceOrderId" IS NULL
    AND "subscriptionInvoiceId" IS NULL AND "managedMarketingRequestId" IS NULL
  ) OR (
    "subjectType" = 'MARKETPLACE_CHECKOUT'
    AND "orderId" IS NULL AND "marketplaceCheckoutId" IS NOT NULL
    AND "subscriptionInvoiceId" IS NULL AND "managedMarketingRequestId" IS NULL
  ) OR (
    "subjectType" = 'SUBSCRIPTION_INVOICE'
    AND "orderId" IS NULL AND "marketplaceCheckoutId" IS NULL AND "marketplaceOrderId" IS NULL
    AND "subscriptionInvoiceId" IS NOT NULL AND "userId" IS NOT NULL
    AND "managedMarketingRequestId" IS NULL
  ) OR (
    "subjectType" = 'MANAGED_MARKETING_REQUEST'
    AND "orderId" IS NULL AND "marketplaceCheckoutId" IS NULL AND "marketplaceOrderId" IS NULL
    AND "subscriptionInvoiceId" IS NULL AND "managedMarketingRequestId" IS NOT NULL
    AND "userId" IS NOT NULL
  )
);

CREATE OR REPLACE FUNCTION "MarketplaceCheckout_payment_subject_guard"() RETURNS TRIGGER AS $$
DECLARE
  checkout_customer_id TEXT;
  checkout_guest_hash TEXT;
  order_checkout_id TEXT;
  invoice_payer_id TEXT;
  managed_marketing_requester_id TEXT;
BEGIN
  IF NEW."subjectType" = 'COURIER_ORDER' THEN
    IF NEW."orderId" IS NULL OR NEW."userId" IS NULL OR NEW."marketplaceCheckoutId" IS NOT NULL OR NEW."marketplaceOrderId" IS NOT NULL OR NEW."subscriptionInvoiceId" IS NOT NULL OR NEW."managedMarketingRequestId" IS NOT NULL THEN
      RAISE EXCEPTION 'Courier payments require exactly one courier order and payer';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."subjectType" = 'SUBSCRIPTION_INVOICE' THEN
    IF NEW."orderId" IS NOT NULL OR NEW."marketplaceCheckoutId" IS NOT NULL OR NEW."marketplaceOrderId" IS NOT NULL OR NEW."subscriptionInvoiceId" IS NULL OR NEW."userId" IS NULL OR NEW."managedMarketingRequestId" IS NOT NULL THEN
      RAISE EXCEPTION 'Subscription payments require exactly one invoice and payer';
    END IF;
    SELECT "payerUserId" INTO invoice_payer_id FROM "SubscriptionInvoice" WHERE "id" = NEW."subscriptionInvoiceId";
    IF invoice_payer_id IS DISTINCT FROM NEW."userId" THEN
      RAISE EXCEPTION 'Subscription payment payer does not match invoice payer';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."subjectType" = 'MANAGED_MARKETING_REQUEST' THEN
    IF NEW."orderId" IS NOT NULL OR NEW."marketplaceCheckoutId" IS NOT NULL OR NEW."marketplaceOrderId" IS NOT NULL OR NEW."subscriptionInvoiceId" IS NOT NULL OR NEW."managedMarketingRequestId" IS NULL OR NEW."userId" IS NULL THEN
      RAISE EXCEPTION 'Managed marketing payments require exactly one campaign request and requester';
    END IF;
    SELECT "requesterUserId" INTO managed_marketing_requester_id FROM "ManagedMarketingRequest" WHERE "id" = NEW."managedMarketingRequestId";
    IF managed_marketing_requester_id IS DISTINCT FROM NEW."userId" THEN
      RAISE EXCEPTION 'Managed marketing payment payer does not match campaign requester';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."orderId" IS NOT NULL OR NEW."marketplaceCheckoutId" IS NULL OR NEW."subscriptionInvoiceId" IS NOT NULL OR NEW."managedMarketingRequestId" IS NOT NULL THEN
    RAISE EXCEPTION 'Marketplace payments require exactly one marketplace checkout';
  END IF;
  SELECT "customerUserId", "guestAccessTokenHash" INTO checkout_customer_id, checkout_guest_hash FROM "MarketplaceCheckout" WHERE "id" = NEW."marketplaceCheckoutId";
  IF checkout_customer_id IS NULL AND checkout_guest_hash IS NULL THEN
    RAISE EXCEPTION 'Guest marketplace payment lacks checkout ownership evidence';
  END IF;
  IF checkout_customer_id IS NOT NULL AND NEW."userId" IS DISTINCT FROM checkout_customer_id THEN
    RAISE EXCEPTION 'Marketplace payment payer does not match checkout customer';
  END IF;
  IF checkout_customer_id IS NULL AND NEW."userId" IS NOT NULL THEN
    RAISE EXCEPTION 'Guest marketplace payment cannot claim payer';
  END IF;
  IF NEW."marketplaceOrderId" IS NOT NULL THEN
    SELECT "checkoutId" INTO order_checkout_id FROM "MarketplaceOrder" WHERE "id" = NEW."marketplaceOrderId";
    IF order_checkout_id IS DISTINCT FROM NEW."marketplaceCheckoutId" THEN
      RAISE EXCEPTION 'Marketplace payment order belongs to another checkout';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS "Payment_subjectType_managedMarketingRequestId_idx"
  ON "Payment"("subjectType", "managedMarketingRequestId");
