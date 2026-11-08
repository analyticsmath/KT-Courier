-- Safely additive: existing deposits retain their earlier manual review evidence.
ALTER TYPE "PrivateMediaPurpose" ADD VALUE IF NOT EXISTS 'DRIVER_CASH_DEPOSIT_RECEIPT';
ALTER TABLE "DriverProfile" ADD COLUMN "cashLimitAmount" DECIMAL(18,2) NOT NULL DEFAULT 1000.00;
ALTER TABLE "DriverProfile" ADD COLUMN "cashLimitRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DriverCashDeposit" ADD COLUMN "privateMediaObjectId" TEXT;
CREATE UNIQUE INDEX "DriverCashDeposit_privateMediaObjectId_key" ON "DriverCashDeposit"("privateMediaObjectId");
ALTER TABLE "DriverCashDeposit" ADD CONSTRAINT "DriverCashDeposit_privateMediaObjectId_fkey"
 FOREIGN KEY ("privateMediaObjectId") REFERENCES "PrivateMediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_cashLimitAmount_bounds"
 CHECK ("cashLimitAmount" >= 0 AND "cashLimitAmount" <= 1000000);
