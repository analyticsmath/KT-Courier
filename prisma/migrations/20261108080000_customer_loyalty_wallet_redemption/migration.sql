-- No historical rewards, journals, or customer balances are altered.
-- Owner must explicitly enable the protected conversion setting after QA.
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'CUSTOMER_LOYALTY_REWARDS_EXPENSE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'CUSTOMER_LOYALTY_CONVERSION';

INSERT INTO "SystemSetting" ("id","key","label","type","value","createdAt","updatedAt")
VALUES (gen_random_uuid()::text, 'loyalty.conversion_enabled',
        'Enable audited loyalty points conversion to wallet credit',
        'BOOLEAN', 'false'::jsonb, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE "CustomerLoyaltyRedemption" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "pointsRedeemed" BIGINT NOT NULL,
  "availablePointsAfter" BIGINT NOT NULL,
  "walletCreditAmount" DECIMAL(18,2) NOT NULL,
  "pointsRequired" INTEGER NOT NULL,
  "walletRateAmount" DECIMAL(18,2) NOT NULL,
  "journalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerLoyaltyRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerLoyaltyRedemption_account_fkey"
    FOREIGN KEY ("userId") REFERENCES "CustomerLoyaltyAccount"("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerLoyaltyRedemption_journal_fkey"
    FOREIGN KEY ("journalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerLoyaltyRedemption_values_check"
    CHECK ("pointsRedeemed" > 0 AND "availablePointsAfter" >= 0
       AND "walletCreditAmount" > 0 AND "pointsRequired" > 0 AND "walletRateAmount" > 0)
);
CREATE UNIQUE INDEX "CustomerLoyaltyRedemption_journalId_key"
  ON "CustomerLoyaltyRedemption"("journalId");
CREATE UNIQUE INDEX "CustomerLoyaltyRedemption_userId_operationId_key"
  ON "CustomerLoyaltyRedemption"("userId","operationId");
CREATE INDEX "CustomerLoyaltyRedemption_userId_createdAt_idx"
  ON "CustomerLoyaltyRedemption"("userId","createdAt");
