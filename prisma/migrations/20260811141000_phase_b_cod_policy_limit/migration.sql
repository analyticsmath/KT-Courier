-- COD limits are mutable commercial configuration, not code constants.
ALTER TABLE "PaymentMethodPolicy" ADD COLUMN "maximumCodAmount" DECIMAL(18,2);
ALTER TABLE "PaymentMethodPolicy" ADD CONSTRAINT "PaymentMethodPolicy_maximumCodAmount_non_negative" CHECK ("maximumCodAmount" IS NULL OR "maximumCodAmount" >= 0);
