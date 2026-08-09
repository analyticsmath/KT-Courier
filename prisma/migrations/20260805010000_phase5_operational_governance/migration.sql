-- Phase 5 is additive. Existing Phase 3 and Phase 4 migrations remain untouched.
CREATE TABLE "OperationalIncident" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "safeSummary" TEXT NOT NULL,
  "operationalImpact" TEXT,
  "affectedCapabilities" JSONB,
  "detectionSource" TEXT,
  "commanderUserId" TEXT,
  "mitigationSummary" TEXT,
  "resolutionSummary" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalIncident_publicReference_key" ON "OperationalIncident"("publicReference");
CREATE INDEX "OperationalIncident_status_severity_openedAt_idx" ON "OperationalIncident"("status", "severity", "openedAt");
CREATE INDEX "OperationalIncident_commanderUserId_status_idx" ON "OperationalIncident"("commanderUserId", "status");

CREATE TABLE "OperationalIncidentTimeline" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "safeNote" TEXT NOT NULL,
  "actorUserId" TEXT,
  "operationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalIncidentTimeline_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalIncidentTimeline_operationId_key" ON "OperationalIncidentTimeline"("operationId");
CREATE INDEX "OperationalIncidentTimeline_incidentId_createdAt_idx" ON "OperationalIncidentTimeline"("incidentId", "createdAt");
ALTER TABLE "OperationalIncidentTimeline" ADD CONSTRAINT "OperationalIncidentTimeline_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OperationalProcessorRun" (
  "id" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "itemsClaimed" INTEGER NOT NULL DEFAULT 0,
  "itemsCompleted" INTEGER NOT NULL DEFAULT 0,
  "itemsRetried" INTEGER NOT NULL DEFAULT 0,
  "itemsReconciled" INTEGER NOT NULL DEFAULT 0,
  "safeErrorCategory" TEXT,
  "safeSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalProcessorRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalProcessorRun_operationId_key" ON "OperationalProcessorRun"("operationId");
CREATE INDEX "OperationalProcessorRun_jobName_startedAt_idx" ON "OperationalProcessorRun"("jobName", "startedAt");
CREATE INDEX "OperationalProcessorRun_status_leaseExpiresAt_idx" ON "OperationalProcessorRun"("status", "leaseExpiresAt");

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "requesterUserId" TEXT,
  "requestType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "identityVerificationStatus" TEXT NOT NULL DEFAULT 'REQUIRED',
  "scope" JSONB,
  "deadlineAt" TIMESTAMP(3),
  "assignedUserId" TEXT,
  "holdEvaluation" TEXT,
  "safeOutcome" TEXT,
  "operationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrivacyRequest_publicReference_key" ON "PrivacyRequest"("publicReference");
CREATE UNIQUE INDEX "PrivacyRequest_operationId_key" ON "PrivacyRequest"("operationId");
CREATE INDEX "PrivacyRequest_requesterUserId_createdAt_idx" ON "PrivacyRequest"("requesterUserId", "createdAt");
CREATE INDEX "PrivacyRequest_status_deadlineAt_idx" ON "PrivacyRequest"("status", "deadlineAt");

CREATE TABLE "RetentionHold" (
  "id" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectReference" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "releasedByUserId" TEXT,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetentionHold_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RetentionHold_subjectType_subjectReference_key" ON "RetentionHold"("subjectType", "subjectReference");
CREATE INDEX "RetentionHold_releasedAt_idx" ON "RetentionHold"("releasedAt");

CREATE TABLE "LegalDocumentVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "effectiveAt" TIMESTAMP(3),
  "supersededById" TEXT,
  "acceptancePolicy" TEXT,
  "publishedByUserId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalDocumentVersion_publicReference_key" ON "LegalDocumentVersion"("publicReference");
CREATE UNIQUE INDEX "LegalDocumentVersion_documentType_version_jurisdiction_key" ON "LegalDocumentVersion"("documentType", "version", "jurisdiction");
CREATE INDEX "LegalDocumentVersion_documentType_publicationStatus_idx" ON "LegalDocumentVersion"("documentType", "publicationStatus");

CREATE TABLE "LegalDocumentAcceptance" (
  "id" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subjectReference" TEXT NOT NULL DEFAULT '',
  "termsHash" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "safeRequestEvidence" JSONB,
  CONSTRAINT "LegalDocumentAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalDocumentAcceptance_documentVersionId_userId_subjectReference_key" ON "LegalDocumentAcceptance"("documentVersionId", "userId", "subjectReference");
CREATE INDEX "LegalDocumentAcceptance_userId_acceptedAt_idx" ON "LegalDocumentAcceptance"("userId", "acceptedAt");
ALTER TABLE "LegalDocumentAcceptance" ADD CONSTRAINT "LegalDocumentAcceptance_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrivacyRequestEvent" (
  "id" TEXT NOT NULL,
  "privacyRequestId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "safeReasonCode" TEXT NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivacyRequestEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrivacyRequestEvent_operationId_key" ON "PrivacyRequestEvent"("operationId");
CREATE INDEX "PrivacyRequestEvent_privacyRequestId_createdAt_idx" ON "PrivacyRequestEvent"("privacyRequestId", "createdAt");

ALTER TABLE "LegalDocumentVersion" ADD COLUMN "publicationOperationId" TEXT;
CREATE UNIQUE INDEX "LegalDocumentVersion_publicationOperationId_key" ON "LegalDocumentVersion"("publicationOperationId");
