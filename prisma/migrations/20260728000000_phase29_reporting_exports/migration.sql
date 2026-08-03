-- CreateEnum
CREATE TYPE "ReportAudience" AS ENUM ('CUSTOMER', 'STORE', 'DRIVER', 'PROMOTER', 'RECRUITMENT', 'DEVELOPER', 'ADMINISTRATOR');

DROP TABLE IF EXISTS "ReportJob" CASCADE;
DROP TYPE IF EXISTS "ReportJobStatus" CASCADE;

-- CreateEnum
CREATE TYPE "ReportJobStatus" AS ENUM ('REQUESTED', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportExecutionMode" AS ENUM ('SYNCHRONOUS_SUMMARY', 'ASYNCHRONOUS_REPORT', 'ASYNCHRONOUS_EXPORT');

-- CreateEnum
CREATE TYPE "ReportExportFormat" AS ENUM ('CSV', 'JSON', 'XLSX');

-- CreateEnum
CREATE TYPE "ReportReconciliationReason" AS ENUM ('REPORT_JOB_WITHOUT_DEFINITION', 'REPORT_JOB_WITH_INVALID_FILTER_HASH', 'REPORT_JOB_STUCK_RUNNING', 'REPORT_JOB_WITHOUT_ARTIFACT', 'REPORT_ARTIFACT_WITHOUT_JOB', 'REPORT_ARTIFACT_CHECKSUM_MISMATCH', 'REPORT_ARTIFACT_EXPIRED_BUT_AVAILABLE', 'REPORT_PERMISSION_SNAPSHOT_MISMATCH', 'REPORT_OWNER_SCOPE_MISMATCH', 'REPORT_ROW_LIMIT_EXCEEDED', 'REPORT_STORAGE_FAILURE', 'REPORT_DOWNLOAD_AUDIT_MISSING', 'REPORT_DUPLICATE_EXECUTION');

-- CreateEnum
CREATE TYPE "ReportReconciliationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CONVERGED');

-- CreateTable
CREATE TABLE "ReportDefinition" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "audience" "ReportAudience" NOT NULL,
    "requiredPermission" TEXT NOT NULL,
    "resourceOwnerRule" TEXT NOT NULL,
    "allowedFormats" JSONB NOT NULL,
    "allowedFilters" JSONB NOT NULL,
    "maximumDateRangeDays" INTEGER,
    "maximumRowCount" INTEGER NOT NULL DEFAULT 10000,
    "defaultOrdering" JSONB,
    "sensitivity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "piiPolicy" TEXT NOT NULL DEFAULT 'MINIMIZED',
    "currencyPolicy" TEXT NOT NULL DEFAULT 'ZAR_EXACT',
    "timezonePolicy" TEXT NOT NULL DEFAULT 'UTC',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDefinitionVersion" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "frozenSnapshot" JSONB NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDefinitionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "ownerScope" JSONB NOT NULL,
    "permissionSnapshot" JSONB NOT NULL,
    "normalizedFilters" JSONB NOT NULL,
    "filterHash" TEXT NOT NULL,
    "executionMode" "ReportExecutionMode" NOT NULL DEFAULT 'ASYNCHRONOUS_EXPORT',
    "outputFormat" "ReportExportFormat" NOT NULL DEFAULT 'CSV',
    "requestedTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "requestedCurrencyPolicy" TEXT NOT NULL DEFAULT 'ZAR_EXACT',
    "rowCountLimit" INTEGER NOT NULL DEFAULT 10000,
    "rowCount" INTEGER,
    "status" "ReportJobStatus" NOT NULL DEFAULT 'REQUESTED',
    "errorMessage" TEXT,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExportArtifact" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "format" "ReportExportFormat" NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL_SECURE',
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "encryptionStatus" TEXT NOT NULL DEFAULT 'NONE',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportExportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDownloadAudit" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "downloadTokenHash" TEXT NOT NULL,
    "authenticatedUserId" TEXT NOT NULL,
    "authenticatedRole" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDownloadAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAuditEvent" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityReference" TEXT,
    "safeEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportReconciliationCase" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "reason" "ReportReconciliationReason" NOT NULL,
    "status" "ReportReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "jobId" TEXT,
    "artifactId" TEXT,
    "safeSummary" TEXT NOT NULL,
    "safeEvidence" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportReconciliationCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportDefinition_publicReference_key" ON "ReportDefinition"("publicReference");
CREATE UNIQUE INDEX "ReportDefinition_key_key" ON "ReportDefinition"("key");
CREATE INDEX "ReportDefinition_audience_active_idx" ON "ReportDefinition"("audience", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDefinitionVersion_publicReference_key" ON "ReportDefinitionVersion"("publicReference");
CREATE UNIQUE INDEX "ReportDefinitionVersion_definitionId_version_key" ON "ReportDefinitionVersion"("definitionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ReportJob_publicReference_key" ON "ReportJob"("publicReference");
CREATE INDEX "ReportJob_requesterUserId_createdAt_idx" ON "ReportJob"("requesterUserId", "createdAt");
CREATE INDEX "ReportJob_status_createdAt_idx" ON "ReportJob"("status", "createdAt");
CREATE INDEX "ReportJob_definitionKey_status_idx" ON "ReportJob"("definitionKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReportExportArtifact_publicReference_key" ON "ReportExportArtifact"("publicReference");
CREATE UNIQUE INDEX "ReportExportArtifact_jobId_key" ON "ReportExportArtifact"("jobId");
CREATE INDEX "ReportExportArtifact_expiresAt_idx" ON "ReportExportArtifact"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDownloadAudit_publicReference_key" ON "ReportDownloadAudit"("publicReference");
CREATE INDEX "ReportDownloadAudit_artifactId_downloadedAt_idx" ON "ReportDownloadAudit"("artifactId", "downloadedAt");
CREATE INDEX "ReportDownloadAudit_authenticatedUserId_downloadedAt_idx" ON "ReportDownloadAudit"("authenticatedUserId", "downloadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAuditEvent_publicReference_key" ON "ReportAuditEvent"("publicReference");
CREATE INDEX "ReportAuditEvent_eventType_createdAt_idx" ON "ReportAuditEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportReconciliationCase_publicReference_key" ON "ReportReconciliationCase"("publicReference");
CREATE INDEX "ReportReconciliationCase_status_createdAt_idx" ON "ReportReconciliationCase"("status", "createdAt");
