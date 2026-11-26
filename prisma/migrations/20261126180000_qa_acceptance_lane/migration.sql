-- CreateEnum
CREATE TYPE "QaAcceptanceRole" AS ENUM ('CUSTOMER', 'VENDOR', 'DRIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "QaAcceptanceRunStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "operatingHours" JSONB;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qaAcceptanceRunId" TEXT;

-- AlterTable
ALTER TABLE "CashOnDelivery" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qaAcceptanceRunId" TEXT;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "isQaIsolated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CommissionAccrual" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StoreEarning" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DriverEarning" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MarketplaceCheckout" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qaAcceptanceRunId" TEXT;

-- AlterTable
ALTER TABLE "MarketplaceOrder" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qaAcceptanceRunId" TEXT;

-- AlterTable
ALTER TABLE "MarketplaceStoreOrder" ADD COLUMN "isQaAcceptance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qaAcceptanceRunId" TEXT;

-- CreateTable
CREATE TABLE "QaAcceptancePrincipal" (
    "id" TEXT NOT NULL,
    "publicReference" VARCHAR(80) NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "QaAcceptanceRole" NOT NULL,
    "storeId" TEXT,
    "driverProfileId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "label" VARCHAR(120),
    "notes" VARCHAR(500),
    "enrolledByUserId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" VARCHAR(300),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QaAcceptancePrincipal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaAcceptanceRun" (
    "id" TEXT NOT NULL,
    "publicReference" VARCHAR(80) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "status" "QaAcceptanceRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "storeId" TEXT,
    "customerUserId" TEXT,
    "driverProfileId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" TEXT,
    "archiveReason" VARCHAR(300),
    "stepState" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QaAcceptanceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_isQaAcceptance_idx" ON "User"("isQaAcceptance");

-- CreateIndex
CREATE INDEX "DriverProfile_isQaAcceptance_idx" ON "DriverProfile"("isQaAcceptance");

-- CreateIndex
CREATE INDEX "Store_isQaAcceptance_idx" ON "Store"("isQaAcceptance");

-- CreateIndex
CREATE INDEX "Order_isQaAcceptance_createdAt_idx" ON "Order"("isQaAcceptance", "createdAt");

-- CreateIndex
CREATE INDEX "Order_qaAcceptanceRunId_idx" ON "Order"("qaAcceptanceRunId");

-- CreateIndex
CREATE INDEX "CashOnDelivery_isQaAcceptance_status_idx" ON "CashOnDelivery"("isQaAcceptance", "status");

-- CreateIndex
CREATE INDEX "Payment_isQaAcceptance_createdAt_idx" ON "Payment"("isQaAcceptance", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_qaAcceptanceRunId_idx" ON "Payment"("qaAcceptanceRunId");

-- CreateIndex
CREATE INDEX "Wallet_isQaIsolated_idx" ON "Wallet"("isQaIsolated");

-- CreateIndex
CREATE INDEX "CommissionAccrual_isQaAcceptance_status_idx" ON "CommissionAccrual"("isQaAcceptance", "status");

-- CreateIndex
CREATE INDEX "StoreEarning_isQaAcceptance_status_idx" ON "StoreEarning"("isQaAcceptance", "status");

-- CreateIndex
CREATE INDEX "DriverEarning_isQaAcceptance_status_idx" ON "DriverEarning"("isQaAcceptance", "status");

-- CreateIndex
CREATE INDEX "MarketplaceCheckout_isQaAcceptance_createdAt_idx" ON "MarketplaceCheckout"("isQaAcceptance", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceCheckout_qaAcceptanceRunId_idx" ON "MarketplaceCheckout"("qaAcceptanceRunId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_isQaAcceptance_createdAt_idx" ON "MarketplaceOrder"("isQaAcceptance", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_qaAcceptanceRunId_idx" ON "MarketplaceOrder"("qaAcceptanceRunId");

-- CreateIndex
CREATE INDEX "MarketplaceStoreOrder_isQaAcceptance_status_idx" ON "MarketplaceStoreOrder"("isQaAcceptance", "status");

-- CreateIndex
CREATE INDEX "MarketplaceStoreOrder_qaAcceptanceRunId_idx" ON "MarketplaceStoreOrder"("qaAcceptanceRunId");

-- CreateIndex
CREATE UNIQUE INDEX "QaAcceptancePrincipal_publicReference_key" ON "QaAcceptancePrincipal"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "QaAcceptancePrincipal_userId_key" ON "QaAcceptancePrincipal"("userId");

-- CreateIndex
CREATE INDEX "QaAcceptancePrincipal_role_active_idx" ON "QaAcceptancePrincipal"("role", "active");

-- CreateIndex
CREATE INDEX "QaAcceptancePrincipal_storeId_active_idx" ON "QaAcceptancePrincipal"("storeId", "active");

-- CreateIndex
CREATE INDEX "QaAcceptancePrincipal_driverProfileId_active_idx" ON "QaAcceptancePrincipal"("driverProfileId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "QaAcceptanceRun_publicReference_key" ON "QaAcceptanceRun"("publicReference");

-- CreateIndex
CREATE INDEX "QaAcceptanceRun_status_startedAt_idx" ON "QaAcceptanceRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "QaAcceptanceRun_storeId_status_idx" ON "QaAcceptanceRun"("storeId", "status");

-- CreateIndex
CREATE INDEX "QaAcceptanceRun_customerUserId_status_idx" ON "QaAcceptanceRun"("customerUserId", "status");

-- CreateIndex
CREATE INDEX "QaAcceptanceRun_driverProfileId_status_idx" ON "QaAcceptanceRun"("driverProfileId", "status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_qaAcceptanceRunId_fkey" FOREIGN KEY ("qaAcceptanceRunId") REFERENCES "QaAcceptanceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_qaAcceptanceRunId_fkey" FOREIGN KEY ("qaAcceptanceRunId") REFERENCES "QaAcceptanceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_qaAcceptanceRunId_fkey" FOREIGN KEY ("qaAcceptanceRunId") REFERENCES "QaAcceptanceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_qaAcceptanceRunId_fkey" FOREIGN KEY ("qaAcceptanceRunId") REFERENCES "QaAcceptanceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceStoreOrder" ADD CONSTRAINT "MarketplaceStoreOrder_qaAcceptanceRunId_fkey" FOREIGN KEY ("qaAcceptanceRunId") REFERENCES "QaAcceptanceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptancePrincipal" ADD CONSTRAINT "QaAcceptancePrincipal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptancePrincipal" ADD CONSTRAINT "QaAcceptancePrincipal_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptancePrincipal" ADD CONSTRAINT "QaAcceptancePrincipal_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptancePrincipal" ADD CONSTRAINT "QaAcceptancePrincipal_enrolledByUserId_fkey" FOREIGN KEY ("enrolledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptancePrincipal" ADD CONSTRAINT "QaAcceptancePrincipal_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptanceRun" ADD CONSTRAINT "QaAcceptanceRun_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptanceRun" ADD CONSTRAINT "QaAcceptanceRun_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptanceRun" ADD CONSTRAINT "QaAcceptanceRun_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptanceRun" ADD CONSTRAINT "QaAcceptanceRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaAcceptanceRun" ADD CONSTRAINT "QaAcceptanceRun_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
