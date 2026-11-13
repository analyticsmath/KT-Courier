-- Add an isolated low-value Paystack verification ledger; no existing
-- payment/order tables or settlement journal are changed.
CREATE TABLE "PaystackLiveVerification" (
    "id" TEXT NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "payerEmail" VARCHAR(254) NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 100,
    "status" VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    "checkoutUrl" TEXT,
    "providerTransactionId" VARCHAR(80),
    "failureCode" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    CONSTRAINT "PaystackLiveVerification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaystackLiveVerification_amountCents_check" CHECK ("amountCents" = 100),
    CONSTRAINT "PaystackLiveVerification_status_check" CHECK ("status" IN ('CREATED','CHECKOUT_READY','UNKNOWN','SUCCEEDED','FAILED'))
);

CREATE UNIQUE INDEX "PaystackLiveVerification_reference_key" ON "PaystackLiveVerification"("reference");
CREATE UNIQUE INDEX "PaystackLiveVerification_idempotencyKey_key" ON "PaystackLiveVerification"("idempotencyKey");
CREATE INDEX "PaystackLiveVerification_actorUserId_createdAt_idx" ON "PaystackLiveVerification"("actorUserId", "createdAt");
CREATE INDEX "PaystackLiveVerification_status_createdAt_idx" ON "PaystackLiveVerification"("status", "createdAt");
