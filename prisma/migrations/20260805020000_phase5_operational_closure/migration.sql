-- Phase 5 Operational Closure Additive Migration

ALTER TABLE "OperationalProcessorRun" ADD COLUMN IF NOT EXISTS "partition" TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS "OperationalProcessorRun_jobName_partition_startedAt_idx" ON "OperationalProcessorRun"("jobName", "partition", "startedAt");
