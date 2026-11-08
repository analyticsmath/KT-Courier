-- Add non-monetary loyalty source reconciliation. Existing orders and
-- payments are not edited or backfilled. Rewards are not autoactivated.
CREATE TABLE "CustomerLoyaltyAccount" (
  "userId" TEXT NOT NULL,
  "availablePoints" BIGINT NOT NULL DEFAULT 0,
  "debtPoints" BIGINT NOT NULL DEFAULT 0,
  "lifetimeEarnedPoints" BIGINT NOT NULL DEFAULT 0,
  "lifetimeReversedPoints" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerLoyaltyAccount_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "CustomerLoyaltyAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerLoyaltyAccount_nonnegative_check"
    CHECK ("availablePoints" >= 0 AND "debtPoints" >= 0 AND "lifetimeEarnedPoints" >= 0 AND "lifetimeReversedPoints" >= 0)
);
CREATE INDEX "CustomerLoyaltyAccount_availablePoints_idx" ON "CustomerLoyaltyAccount"("availablePoints");
CREATE TABLE "CustomerLoyaltyEarning" (
  "paymentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pointsPerZar" INTEGER NOT NULL,
  "recognizedPoints" BIGINT NOT NULL DEFAULT 0,
  "eligibleBasisAmount" DECIMAL(18,2) NOT NULL,
  "vatAmount" DECIMAL(18,2) NOT NULL,
  "refundedAmount" DECIMAL(18,2) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerLoyaltyEarning_pkey" PRIMARY KEY ("paymentId"),
  CONSTRAINT "CustomerLoyaltyEarning_account_fkey"
    FOREIGN KEY ("userId") REFERENCES "CustomerLoyaltyAccount"("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerLoyaltyEarning_payment_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerLoyaltyEarning_nonnegative_check"
    CHECK ("pointsPerZar" >= 0 AND "recognizedPoints" >= 0 AND "revision" >= 1)
);
CREATE INDEX "CustomerLoyaltyEarning_userId_createdAt_idx" ON "CustomerLoyaltyEarning"("userId","createdAt");
CREATE TABLE "CustomerLoyaltyMovement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "deltaPoints" BIGINT NOT NULL,
  "availablePointsAfter" BIGINT NOT NULL,
  "debtPointsAfter" BIGINT NOT NULL,
  "policySnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerLoyaltyMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerLoyaltyMovement_account_fkey"
    FOREIGN KEY ("userId") REFERENCES "CustomerLoyaltyAccount"("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerLoyaltyMovement_earning_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "CustomerLoyaltyEarning"("paymentId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerLoyaltyMovement_nonnegative_check"
    CHECK ("availablePointsAfter" >= 0 AND "debtPointsAfter" >= 0 AND "revision" >= 1)
);
CREATE UNIQUE INDEX "CustomerLoyaltyMovement_paymentId_revision_key" ON "CustomerLoyaltyMovement"("paymentId","revision");
CREATE INDEX "CustomerLoyaltyMovement_userId_createdAt_idx" ON "CustomerLoyaltyMovement"("userId","createdAt");
