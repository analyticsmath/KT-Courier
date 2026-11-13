ALTER TABLE "ReportJob" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
CREATE INDEX "ReportJob_status_nextAttemptAt_idx" ON "ReportJob"("status", "nextAttemptAt");
