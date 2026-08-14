-- Phase B ENG-ADS-006: explicit managed-marketing lifecycle terminal and pause states.
ALTER TYPE "ManagedMarketingRequestStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "ManagedMarketingRequestStatus" ADD VALUE IF NOT EXISTS 'ENDED';

ALTER TABLE "ManagedMarketingRequest"
  ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
