-- Additive guest-only verification evidence. Existing users, orders and payments are unchanged.
CREATE TABLE "MarketplaceGuestContactVerification" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "contactSnapshotId" TEXT NOT NULL,
  "checkoutId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceGuestContactVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceGuestContactVerification_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5),
  CONSTRAINT "MarketplaceGuestContactVerification_contactSnapshotId_fkey" FOREIGN KEY ("contactSnapshotId") REFERENCES "MarketplaceCheckoutContactSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceGuestContactVerification_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MarketplaceGuestContactVerification_publicReference_key" ON "MarketplaceGuestContactVerification"("publicReference");
CREATE UNIQUE INDEX "MarketplaceGuestContactVerification_contactSnapshotId_operationId_key" ON "MarketplaceGuestContactVerification"("contactSnapshotId", "operationId");
CREATE INDEX "MarketplaceGuestContactVerification_contactSnapshotId_createdAt_idx" ON "MarketplaceGuestContactVerification"("contactSnapshotId", "createdAt");
CREATE INDEX "MarketplaceGuestContactVerification_checkoutId_createdAt_idx" ON "MarketplaceGuestContactVerification"("checkoutId", "createdAt");
