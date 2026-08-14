-- Phase B COD lifecycle and custody evidence. Existing payment and ledger
-- authorities remain canonical; this adds no balance columns or duplicate ledger.
CREATE TYPE "CashOnDeliveryStatus" AS ENUM ('PENDING', 'READY_FOR_COLLECTION', 'COLLECTED', 'COLLECTION_FAILED', 'UNDER_RECONCILIATION', 'RECONCILED', 'DISPUTED', 'CANCELLED');

CREATE TABLE "CashOnDelivery" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT,
  "policyMode" "PaymentMethodPolicyMode" NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "authoritativePayable" DECIMAL(18,2) NOT NULL,
  "digitalRequired" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "digitalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "cashObligation" DECIMAL(18,2) NOT NULL,
  "cashCollected" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "cashReconciled" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" "CashOnDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "collectorDriverId" TEXT,
  "collectedAt" TIMESTAMP(3),
  "collectionOperationId" TEXT,
  "collectionRequestHash" TEXT,
  "collectionJournalId" TEXT,
  "failureReasonCode" TEXT,
  "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "reconciledAt" TIMESTAMP(3),
  "reconciliationActorId" TEXT,
  "reconciliationJournalId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashOnDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashOnDelivery_amounts_non_negative" CHECK ("authoritativePayable" >= 0 AND "digitalRequired" >= 0 AND "digitalPaid" >= 0 AND "cashObligation" >= 0 AND "cashCollected" >= 0 AND "cashReconciled" >= 0),
  CONSTRAINT "CashOnDelivery_payment_split_valid" CHECK ("digitalRequired" + "cashObligation" <= "authoritativePayable"),
  CONSTRAINT "CashOnDelivery_collection_bound" CHECK ("cashCollected" <= "cashObligation"),
  CONSTRAINT "CashOnDelivery_reconciliation_bound" CHECK ("cashReconciled" <= "cashCollected")
);

CREATE TABLE "CashOnDeliveryEvent" (
  "id" TEXT NOT NULL,
  "cashOnDeliveryId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT,
  "safeReasonCode" TEXT,
  "safeEvidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashOnDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashOnDeliveryReconciliation" (
  "id" TEXT NOT NULL,
  "cashOnDeliveryId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "expectedAmount" DECIMAL(18,2) NOT NULL,
  "receivedAmount" DECIMAL(18,2) NOT NULL,
  "discrepancyAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "collectorDriverId" TEXT NOT NULL,
  "reconciledByUserId" TEXT NOT NULL,
  "evidenceReference" TEXT,
  "journalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashOnDeliveryReconciliation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashOnDeliveryReconciliation_amounts_non_negative" CHECK ("expectedAmount" >= 0 AND "receivedAmount" >= 0)
);

CREATE UNIQUE INDEX "CashOnDelivery_publicReference_key" ON "CashOnDelivery"("publicReference");
CREATE UNIQUE INDEX "CashOnDelivery_orderId_key" ON "CashOnDelivery"("orderId");
CREATE UNIQUE INDEX "CashOnDelivery_collectionOperationId_key" ON "CashOnDelivery"("collectionOperationId");
CREATE UNIQUE INDEX "CashOnDelivery_collectionJournalId_key" ON "CashOnDelivery"("collectionJournalId");
CREATE UNIQUE INDEX "CashOnDelivery_reconciliationJournalId_key" ON "CashOnDelivery"("reconciliationJournalId");
CREATE INDEX "CashOnDelivery_status_collectorDriverId_idx" ON "CashOnDelivery"("status", "collectorDriverId");
CREATE INDEX "CashOnDelivery_paymentId_idx" ON "CashOnDelivery"("paymentId");
CREATE UNIQUE INDEX "CashOnDeliveryEvent_operationId_key" ON "CashOnDeliveryEvent"("operationId");
CREATE INDEX "CashOnDeliveryEvent_cashOnDeliveryId_createdAt_idx" ON "CashOnDeliveryEvent"("cashOnDeliveryId", "createdAt");
CREATE UNIQUE INDEX "CashOnDeliveryReconciliation_operationId_key" ON "CashOnDeliveryReconciliation"("operationId");
CREATE UNIQUE INDEX "CashOnDeliveryReconciliation_journalId_key" ON "CashOnDeliveryReconciliation"("journalId");
CREATE UNIQUE INDEX "CashOnDeliveryReconciliation_cashOnDeliveryId_key" ON "CashOnDeliveryReconciliation"("cashOnDeliveryId");

ALTER TABLE "CashOnDelivery" ADD CONSTRAINT "CashOnDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashOnDeliveryEvent" ADD CONSTRAINT "CashOnDeliveryEvent_cashOnDeliveryId_fkey" FOREIGN KEY ("cashOnDeliveryId") REFERENCES "CashOnDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashOnDeliveryReconciliation" ADD CONSTRAINT "CashOnDeliveryReconciliation_cashOnDeliveryId_fkey" FOREIGN KEY ("cashOnDeliveryId") REFERENCES "CashOnDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
