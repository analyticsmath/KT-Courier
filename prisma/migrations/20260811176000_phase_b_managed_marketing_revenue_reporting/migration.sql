-- Phase B ENG-ADS-007: managed-marketing payment linkage, revenue recognition and performance reporting.
ALTER TYPE "PaymentSubjectType" ADD VALUE IF NOT EXISTS 'MANAGED_MARKETING_REQUEST';
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'MANAGED_MARKETING_TAX_PAYABLE';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "managedMarketingRequestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_managedMarketingRequestId_key" ON "Payment"("managedMarketingRequestId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_managedMarketingRequestId_fkey" FOREIGN KEY ("managedMarketingRequestId") REFERENCES "ManagedMarketingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ManagedMarketingBillingEvidence" (
  "id" TEXT NOT NULL,
  "managedMarketingRequestId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "receiptLedgerJournalId" TEXT NOT NULL,
  "revenueLedgerJournalId" TEXT NOT NULL,
  "grossAmount" DECIMAL(18,2) NOT NULL,
  "revenueAmount" DECIMAL(18,2) NOT NULL,
  "taxAmount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "operationId" TEXT NOT NULL,
  "recognizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagedMarketingBillingEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ManagedMarketingBillingEvidence_managedMarketingRequestId_key" ON "ManagedMarketingBillingEvidence"("managedMarketingRequestId");
CREATE UNIQUE INDEX "ManagedMarketingBillingEvidence_paymentId_key" ON "ManagedMarketingBillingEvidence"("paymentId");
CREATE UNIQUE INDEX "ManagedMarketingBillingEvidence_receiptLedgerJournalId_key" ON "ManagedMarketingBillingEvidence"("receiptLedgerJournalId");
CREATE UNIQUE INDEX "ManagedMarketingBillingEvidence_revenueLedgerJournalId_key" ON "ManagedMarketingBillingEvidence"("revenueLedgerJournalId");
CREATE UNIQUE INDEX "ManagedMarketingBillingEvidence_operationId_key" ON "ManagedMarketingBillingEvidence"("operationId");
CREATE INDEX "ManagedMarketingBillingEvidence_recognizedAt_idx" ON "ManagedMarketingBillingEvidence"("recognizedAt");
ALTER TABLE "ManagedMarketingBillingEvidence" ADD CONSTRAINT "ManagedMarketingBillingEvidence_request_fkey" FOREIGN KEY ("managedMarketingRequestId") REFERENCES "ManagedMarketingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingBillingEvidence" ADD CONSTRAINT "ManagedMarketingBillingEvidence_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingBillingEvidence" ADD CONSTRAINT "ManagedMarketingBillingEvidence_receipt_journal_fkey" FOREIGN KEY ("receiptLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingBillingEvidence" ADD CONSTRAINT "ManagedMarketingBillingEvidence_revenue_journal_fkey" FOREIGN KEY ("revenueLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ManagedMarketingPerformanceRecord" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "managedMarketingRequestId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "periodStartsAt" TIMESTAMP(3) NOT NULL,
  "periodEndsAt" TIMESTAMP(3) NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "externalReference" TEXT NOT NULL,
  "safeEvidence" JSONB,
  "recordedByUserId" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagedMarketingPerformanceRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ManagedMarketingPerformanceRecord_publicReference_key" ON "ManagedMarketingPerformanceRecord"("publicReference");
CREATE UNIQUE INDEX "ManagedMarketingPerformanceRecord_operationId_key" ON "ManagedMarketingPerformanceRecord"("operationId");
CREATE INDEX "ManagedMarketingPerformanceRecord_request_period_idx" ON "ManagedMarketingPerformanceRecord"("managedMarketingRequestId", "periodStartsAt");
ALTER TABLE "ManagedMarketingPerformanceRecord" ADD CONSTRAINT "ManagedMarketingPerformanceRecord_request_fkey" FOREIGN KEY ("managedMarketingRequestId") REFERENCES "ManagedMarketingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
