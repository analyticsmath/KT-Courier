-- Store independently audited driver engagement classification.
-- No historic driver assignment, entitlement or earnings is rewritten.
CREATE TYPE "DriverEngagementType" AS ENUM ('FREELANCE', 'SALARIED');
ALTER TABLE "DriverProfile"
  ADD COLUMN "engagementType" "DriverEngagementType",
  ADD COLUMN "engagementContractReference" TEXT,
  ADD COLUMN "engagementEffectiveFrom" TIMESTAMP(3),
  ADD COLUMN "engagementRevision" INTEGER NOT NULL DEFAULT 0;
