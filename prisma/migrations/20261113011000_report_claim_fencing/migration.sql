ALTER TABLE "ReportJob" ADD COLUMN "claimToken" TEXT, ADD COLUMN "claimExpiresAt" TIMESTAMP(3);
CREATE INDEX "ReportJob_status_claimExpiresAt_idx" ON "ReportJob"("status", "claimExpiresAt");
