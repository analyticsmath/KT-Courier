-- Phase B claims/remedies: case, evidence, append-only investigation and
-- remedy linkage. This migration deliberately does not create a money writer.
CREATE TYPE "ClaimReason" AS ENUM ('WRONG_ITEM', 'MISSING_ITEM', 'DAMAGED', 'DEFECTIVE', 'SPOILED_OR_UNSAFE', 'NON_DELIVERY', 'DELIVERY_ISSUE', 'PAYMENT_ISSUE', 'OTHER');
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'AWAITING_PARTICIPANT_RESPONSE', 'UNDER_INVESTIGATION', 'DECIDED', 'REMEDY_IN_PROGRESS', 'CLOSED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ClaimResponsibility" AS ENUM ('STORE', 'DRIVER', 'CUSTOMER', 'PLATFORM', 'PAYMENT_PROVIDER', 'UNDETERMINED', 'MULTIPLE');
CREATE TYPE "ClaimRemedyType" AS ENUM ('NO_REMEDY', 'REDELIVERY', 'REPLACEMENT', 'PARTIAL_REFUND', 'FULL_REFUND', 'STORE_CREDIT');
CREATE TYPE "ClaimPaymentSource" AS ENUM ('DIGITAL', 'CASH', 'MIXED');

CREATE TABLE "Claim" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "claimantUserId" TEXT NOT NULL,
  "orderId" TEXT,
  "marketplaceOrderId" TEXT,
  "marketplaceOrderLineId" TEXT,
  "reason" "ClaimReason" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
  "paymentSource" "ClaimPaymentSource" NOT NULL,
  "duplicateFingerprint" TEXT NOT NULL,
  "fraudFlaggedAt" TIMESTAMP(3),
  "fraudFlagReason" TEXT,
  "finding" "ClaimResponsibility" NOT NULL DEFAULT 'UNDETERMINED',
  "findingReason" TEXT,
  "findingActorUserId" TEXT,
  "findingAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "decisionPolicyReference" TEXT,
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Claim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Claim_order_association_check" CHECK ("orderId" IS NOT NULL OR "marketplaceOrderId" IS NOT NULL)
);
CREATE UNIQUE INDEX "Claim_publicReference_key" ON "Claim"("publicReference");
CREATE UNIQUE INDEX "Claim_claimantUserId_duplicateFingerprint_key" ON "Claim"("claimantUserId", "duplicateFingerprint");
CREATE INDEX "Claim_claimantUserId_createdAt_idx" ON "Claim"("claimantUserId", "createdAt");
CREATE INDEX "Claim_orderId_status_idx" ON "Claim"("orderId", "status");
CREATE INDEX "Claim_marketplaceOrderId_status_idx" ON "Claim"("marketplaceOrderId", "status");
CREATE INDEX "Claim_status_createdAt_idx" ON "Claim"("status", "createdAt");
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClaimEvidence" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "privateMediaObjectId" TEXT,
  "textualEvidence" TEXT,
  "submittedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClaimEvidence_payload_check" CHECK ("privateMediaObjectId" IS NOT NULL OR "textualEvidence" IS NOT NULL)
);
CREATE UNIQUE INDEX "ClaimEvidence_claimId_privateMediaObjectId_key" ON "ClaimEvidence"("claimId", "privateMediaObjectId");
CREATE INDEX "ClaimEvidence_claimId_createdAt_idx" ON "ClaimEvidence"("claimId", "createdAt");
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_privateMediaObjectId_fkey" FOREIGN KEY ("privateMediaObjectId") REFERENCES "PrivateMediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClaimActivity" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT,
  "participantRole" TEXT,
  "safeDetail" TEXT,
  "evidenceReference" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClaimActivity_claimId_createdAt_idx" ON "ClaimActivity"("claimId", "createdAt");
ALTER TABLE "ClaimActivity" ADD CONSTRAINT "ClaimActivity_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClaimRemedy" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "type" "ClaimRemedyType" NOT NULL,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "amount" DECIMAL(18,2),
  "currency" "LedgerCurrency",
  "paymentRefundId" TEXT,
  "fulfilmentReference" TEXT,
  "mixedPaymentStrategy" TEXT,
  "decidedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClaimRemedy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClaimRemedy_claimId_key" ON "ClaimRemedy"("claimId");
CREATE UNIQUE INDEX "ClaimRemedy_operationId_key" ON "ClaimRemedy"("operationId");
CREATE UNIQUE INDEX "ClaimRemedy_paymentRefundId_key" ON "ClaimRemedy"("paymentRefundId");
ALTER TABLE "ClaimRemedy" ADD CONSTRAINT "ClaimRemedy_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClaimRemedy" ADD CONSTRAINT "ClaimRemedy_paymentRefundId_fkey" FOREIGN KEY ("paymentRefundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "enforce_claim_evidence_private_media"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."privateMediaObjectId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PrivateMediaObject" p
    WHERE p."id" = NEW."privateMediaObjectId" AND p."ownerType" = 'CLAIM' AND p."ownerId" = NEW."claimId" AND p."purpose" = 'CLAIM_EVIDENCE'
  ) THEN RAISE EXCEPTION 'claim evidence must use a CLAIM-owned private media object'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ClaimEvidence_private_media_guard" BEFORE INSERT OR UPDATE ON "ClaimEvidence" FOR EACH ROW EXECUTE FUNCTION "enforce_claim_evidence_private_media"();

CREATE OR REPLACE FUNCTION "claim_activity_append_only"() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'claim activity is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ClaimActivity_no_update" BEFORE UPDATE OR DELETE ON "ClaimActivity" FOR EACH ROW EXECUTE FUNCTION "claim_activity_append_only"();
