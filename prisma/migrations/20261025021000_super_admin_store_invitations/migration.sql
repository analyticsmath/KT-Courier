CREATE TABLE "StoreOnboardingInvitation" (
"id" TEXT PRIMARY KEY,
"email" TEXT NOT NULL,
"storeName" TEXT NOT NULL,
"contactName" TEXT NOT NULL,
"tokenHash" TEXT NOT NULL,
"status" TEXT NOT NULL DEFAULT 'PENDING',
"expiresAt" TIMESTAMP(3) NOT NULL,
"createdByUserId" TEXT NOT NULL,
"claimedByUserId" TEXT,
"claimedStoreId" TEXT,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "StoreOnboardingInvitation_tokenHash_key" ON "StoreOnboardingInvitation"("tokenHash");
CREATE INDEX "StoreOnboardingInvitation_email_status_expiresAt_idx" ON "StoreOnboardingInvitation"("email","status","expiresAt");
