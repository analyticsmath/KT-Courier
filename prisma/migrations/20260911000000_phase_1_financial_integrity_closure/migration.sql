-- AlterEnum: PaymentWebhookProcessingStatus
ALTER TYPE "PaymentWebhookProcessingStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PaymentWebhookProcessingStatus" ADD VALUE 'IGNORED_UNSUPPORTED';

-- AlterEnum: RefundAttemptStatus
ALTER TYPE "RefundAttemptStatus" ADD VALUE 'NEEDS_ATTENTION';

-- AlterEnum: RefundReconciliationReason
ALTER TYPE "RefundReconciliationReason" ADD VALUE 'NEEDS_ATTENTION';

-- AlterEnum: PayoutMethod
ALTER TYPE "PayoutMethod" ADD VALUE 'PAYSTACK_TRANSFER';

-- CreateEnum: PaymentDisputeStatus
CREATE TYPE "PaymentDisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'WON', 'LOST', 'RESOLVED', 'CANCELLED');

-- CreateEnum: PaymentDisputeReason
CREATE TYPE "PaymentDisputeReason" AS ENUM ('FRAUDULENT', 'UNRECOGNIZED', 'PRODUCT_NOT_RECEIVED', 'PRODUCT_UNACCEPTABLE', 'DUPLICATE', 'SUBSCRIPTION_CANCELLED', 'OTHER');

-- AlterTable: PaymentWebhookEvent
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "leaseToken" TEXT;
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "reconciledAt" TIMESTAMP(3);

-- AlterTable: PayoutDestination
ALTER TABLE "PayoutDestination" ADD COLUMN "accountFingerprint" TEXT;
ALTER TABLE "PayoutDestination" ADD COLUMN "payoutValidationStatus" TEXT;
ALTER TABLE "PayoutDestination" ADD COLUMN "payoutValidationEvidence" JSONB;

-- AlterTable: WithdrawalPayoutAttempt
ALTER TABLE "WithdrawalPayoutAttempt" ADD COLUMN "transferCode" TEXT;
ALTER TABLE "WithdrawalPayoutAttempt" ADD COLUMN "providerReference" TEXT;
ALTER TABLE "WithdrawalPayoutAttempt" ADD COLUMN "lastPolledAt" TIMESTAMP(3);

-- AlterTable: CashOnDelivery
ALTER TABLE "CashOnDelivery" ADD COLUMN "remittanceDiscrepancy" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "CashOnDelivery" ADD COLUMN "suspenseJournalId" TEXT;
ALTER TABLE "CashOnDelivery" ADD COLUMN "adjustmentJournalId" TEXT;
ALTER TABLE "CashOnDelivery" ADD COLUMN "adminAdjustmentReason" TEXT;
ALTER TABLE "CashOnDelivery" ADD COLUMN "adminAdjustmentNotes" TEXT;
ALTER TABLE "CashOnDelivery" ADD COLUMN "adminAdjustedByUserId" TEXT;
ALTER TABLE "CashOnDelivery" ADD COLUMN "adminAdjustedAt" TIMESTAMP(3);

-- CreateTable: PaymentDispute
CREATE TABLE "PaymentDispute" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "providerDisputeId" TEXT,
    "paymentId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYSTACK',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
    "status" "PaymentDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" "PaymentDisputeReason" NOT NULL DEFAULT 'OTHER',
    "providerStatus" TEXT,
    "evidenceDueBy" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "lastSynchronizedAt" TIMESTAMP(3),
    "reconciliationRequired" BOOLEAN NOT NULL DEFAULT false,
    "safeEvidenceSnapshot" JSONB,
    "holdLedgerJournalId" TEXT,
    "lossLedgerJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentDisputeHistory
CREATE TABLE "PaymentDisputeHistory" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "fromStatus" "PaymentDisputeStatus",
    "toStatus" "PaymentDisputeStatus" NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorUserId" TEXT,
    "reasonCode" TEXT,
    "safeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentDisputeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: PaymentDispute
CREATE UNIQUE INDEX "PaymentDispute_publicReference_key" ON "PaymentDispute"("publicReference");
CREATE UNIQUE INDEX "PaymentDispute_providerDisputeId_key" ON "PaymentDispute"("providerDisputeId");
CREATE UNIQUE INDEX "PaymentDispute_holdLedgerJournalId_key" ON "PaymentDispute"("holdLedgerJournalId");
CREATE UNIQUE INDEX "PaymentDispute_lossLedgerJournalId_key" ON "PaymentDispute"("lossLedgerJournalId");
CREATE INDEX "PaymentDispute_paymentId_status_idx" ON "PaymentDispute"("paymentId", "status");
CREATE INDEX "PaymentDispute_status_evidenceDueBy_idx" ON "PaymentDispute"("status", "evidenceDueBy");
CREATE INDEX "PaymentDispute_provider_providerDisputeId_idx" ON "PaymentDispute"("provider", "providerDisputeId");

-- CreateIndex: PaymentDisputeHistory
CREATE INDEX "PaymentDisputeHistory_disputeId_createdAt_idx" ON "PaymentDisputeHistory"("disputeId", "createdAt");

-- CreateIndex: WithdrawalPayoutAttempt
CREATE UNIQUE INDEX "WithdrawalPayoutAttempt_transferCode_key" ON "WithdrawalPayoutAttempt"("transferCode");
CREATE UNIQUE INDEX "WithdrawalPayoutAttempt_providerReference_key" ON "WithdrawalPayoutAttempt"("providerReference");

-- CreateIndex: CashOnDelivery
CREATE UNIQUE INDEX "CashOnDelivery_suspenseJournalId_key" ON "CashOnDelivery"("suspenseJournalId");
CREATE UNIQUE INDEX "CashOnDelivery_adjustmentJournalId_key" ON "CashOnDelivery"("adjustmentJournalId");

-- CreateIndex: PaymentWebhookEvent lease claim
CREATE INDEX "PaymentWebhookEvent_lease_claim_idx" ON "PaymentWebhookEvent"("provider", "itnProcessingStatus", "nextAttemptAt", "leaseExpiresAt", "receivedAt");

-- AddForeignKey: PaymentDispute
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PaymentDisputeHistory
ALTER TABLE "PaymentDisputeHistory" ADD CONSTRAINT "PaymentDisputeHistory_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "PaymentDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
