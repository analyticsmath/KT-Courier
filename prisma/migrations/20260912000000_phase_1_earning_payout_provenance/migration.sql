-- CreateEnum: WithdrawalEarningType
CREATE TYPE "WithdrawalEarningType" AS ENUM ('STORE', 'DRIVER');

-- CreateEnum: WithdrawalEarningAllocationStatus
CREATE TYPE "WithdrawalEarningAllocationStatus" AS ENUM ('RESERVED', 'SETTLED', 'CANCELLED');

-- CreateEnum: PaymentDisputeHoldingState
CREATE TYPE "PaymentDisputeHoldingState" AS ENUM ('UNRELEASED_HELD', 'RELEASED_HOLD', 'IN_FLIGHT_HOLD', 'RECOVERY_RECEIVABLE', 'PLATFORM_HELD');

-- AlterTable: PaymentDisputeAllocation
ALTER TABLE "PaymentDisputeAllocation"
  ALTER COLUMN "holdingState" TYPE "PaymentDisputeHoldingState"
  USING ("holdingState"::text::"PaymentDisputeHoldingState");

ALTER TABLE "PaymentDisputeAllocation"
  ADD COLUMN "withdrawalEarningAllocationId" TEXT;

-- CreateTable: WithdrawalEarningAllocation
CREATE TABLE "WithdrawalEarningAllocation" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "withdrawalRequestId" TEXT NOT NULL,
    "earningType" "WithdrawalEarningType" NOT NULL,
    "storeEarningId" TEXT,
    "driverEarningId" TEXT,
    "allocatedAmount" DECIMAL(18,2) NOT NULL,
    "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
    "status" "WithdrawalEarningAllocationStatus" NOT NULL DEFAULT 'RESERVED',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalEarningAllocation_pkey" PRIMARY KEY ("id")
);

-- CheckConstraint: Positive allocatedAmount
ALTER TABLE "WithdrawalEarningAllocation"
  ADD CONSTRAINT "WithdrawalEarningAllocation_positive_amount_check"
  CHECK ("allocatedAmount" > 0);

-- CheckConstraint: Earning FK XOR according to earningType
ALTER TABLE "WithdrawalEarningAllocation"
  ADD CONSTRAINT "WithdrawalEarningAllocation_earning_fk_xor_check"
  CHECK (
    ("earningType" = 'STORE' AND "storeEarningId" IS NOT NULL AND "driverEarningId" IS NULL) OR
    ("earningType" = 'DRIVER' AND "driverEarningId" IS NOT NULL AND "storeEarningId" IS NULL)
  );

-- CreateIndex: WithdrawalEarningAllocation
CREATE UNIQUE INDEX "WithdrawalEarningAllocation_publicReference_key" ON "WithdrawalEarningAllocation"("publicReference");
CREATE UNIQUE INDEX "WithdrawalEarningAllocation_withdrawal_store_earning_key" ON "WithdrawalEarningAllocation"("withdrawalRequestId", "storeEarningId");
CREATE UNIQUE INDEX "WithdrawalEarningAllocation_withdrawal_driver_earning_key" ON "WithdrawalEarningAllocation"("withdrawalRequestId", "driverEarningId");
CREATE INDEX "WithdrawalEarningAllocation_withdrawalRequestId_status_idx" ON "WithdrawalEarningAllocation"("withdrawalRequestId", "status");
CREATE INDEX "WithdrawalEarningAllocation_storeEarningId_status_idx" ON "WithdrawalEarningAllocation"("storeEarningId", "status");
CREATE INDEX "WithdrawalEarningAllocation_driverEarningId_status_idx" ON "WithdrawalEarningAllocation"("driverEarningId", "status");
CREATE INDEX "WithdrawalEarningAllocation_earningType_status_idx" ON "WithdrawalEarningAllocation"("earningType", "status");

-- CreateIndex: PaymentDisputeAllocation withdrawalEarningAllocationId
CREATE INDEX "PaymentDisputeAllocation_withdrawalEarningAllocationId_idx" ON "PaymentDisputeAllocation"("withdrawalEarningAllocationId");

-- AddForeignKey: WithdrawalEarningAllocation
ALTER TABLE "WithdrawalEarningAllocation" ADD CONSTRAINT "WithdrawalEarningAllocation_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WithdrawalEarningAllocation" ADD CONSTRAINT "WithdrawalEarningAllocation_storeEarningId_fkey" FOREIGN KEY ("storeEarningId") REFERENCES "StoreEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WithdrawalEarningAllocation" ADD CONSTRAINT "WithdrawalEarningAllocation_driverEarningId_fkey" FOREIGN KEY ("driverEarningId") REFERENCES "DriverEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PaymentDisputeAllocation
ALTER TABLE "PaymentDisputeAllocation" ADD CONSTRAINT "PaymentDisputeAllocation_withdrawalEarningAllocationId_fkey" FOREIGN KEY ("withdrawalEarningAllocationId") REFERENCES "WithdrawalEarningAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
