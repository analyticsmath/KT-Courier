-- Phase B ENG-PRIV-005/006: canonical DSAR, versioned retention and execution evidence.
ALTER TABLE "PrivacyRequest" ADD COLUMN "requestContext" JSONB;
ALTER TABLE "PrivacyRequest" ADD COLUMN "decision" TEXT;
ALTER TABLE "PrivacyRequest" ADD COLUMN "decisionReason" TEXT;
ALTER TABLE "PrivacyRequest" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "PrivacyRequest" ADD COLUMN "exportReference" TEXT;
ALTER TABLE "RetentionHold" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE TABLE "PrivacyRequestExecutionPlan" (
  "id" TEXT NOT NULL, "privacyRequestId" TEXT NOT NULL, "policySnapshot" JSONB NOT NULL,
  "executionState" TEXT NOT NULL DEFAULT 'PLANNED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PrivacyRequestExecutionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrivacyRequestExecutionPlan_privacyRequestId_key" ON "PrivacyRequestExecutionPlan"("privacyRequestId");
CREATE INDEX "PrivacyRequestExecutionPlan_executionState_createdAt_idx" ON "PrivacyRequestExecutionPlan"("executionState", "createdAt");

CREATE TABLE "RetentionPolicyVersion" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "dataClass" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "action" TEXT NOT NULL, "retentionDays" INTEGER, "effectiveAt" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "legalReviewStatus" TEXT NOT NULL DEFAULT 'LEGAL_REVIEW_REQUIRED', "createdByUserId" TEXT, "activatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetentionPolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RetentionPolicyVersion_publicReference_key" ON "RetentionPolicyVersion"("publicReference");
CREATE UNIQUE INDEX "RetentionPolicyVersion_dataClass_version_key" ON "RetentionPolicyVersion"("dataClass", "version");
CREATE INDEX "RetentionPolicyVersion_dataClass_status_effectiveAt_idx" ON "RetentionPolicyVersion"("dataClass", "status", "effectiveAt");

CREATE TABLE "RetentionExecution" (
  "id" TEXT NOT NULL, "executionKey" TEXT NOT NULL, "policyVersionId" TEXT, "dataClass" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL, "resourceReference" TEXT NOT NULL, "action" TEXT NOT NULL, "status" TEXT NOT NULL,
  "safeReasonCode" TEXT, "actorReference" TEXT, "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RetentionExecution_executionKey_key" ON "RetentionExecution"("executionKey");
CREATE INDEX "RetentionExecution_resourceType_resourceReference_executedAt_idx" ON "RetentionExecution"("resourceType", "resourceReference", "executedAt");
CREATE INDEX "RetentionExecution_status_executedAt_idx" ON "RetentionExecution"("status", "executedAt");
