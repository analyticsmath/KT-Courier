-- Legacy 6amMart migration provenance authority.
-- Stores only safe source identifiers, hashes and target mappings. Raw legacy
-- credentials, tokens, secrets and source dumps are intentionally excluded.

CREATE TYPE "LegacyMigrationRunStatus" AS ENUM (
  'PLANNED',
  'DRY_RUN',
  'VALIDATED',
  'APPLYING',
  'APPLIED',
  'FAILED',
  'ROLLED_BACK'
);

CREATE TABLE "LegacyMigrationRun" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "sourceDatabase" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "sourceMediaFingerprint" TEXT,
  "phase" TEXT NOT NULL,
  "status" "LegacyMigrationRunStatus" NOT NULL DEFAULT 'PLANNED',
  "summary" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegacyMigrationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegacyMigrationMap" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "sourceDatabase" TEXT NOT NULL,
  "sourceTable" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "disposition" TEXT NOT NULL,
  "targetModel" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetPublicReference" TEXT,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegacyMigrationMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegacyMigrationRun_publicReference_key"
  ON "LegacyMigrationRun"("publicReference");

CREATE UNIQUE INDEX "LegacyMigrationRun_source_phase_key"
  ON "LegacyMigrationRun"("sourceSystem", "sourceDatabase", "sourceFingerprint", "phase");

CREATE INDEX "LegacyMigrationRun_status_createdAt_idx"
  ON "LegacyMigrationRun"("status", "createdAt");

CREATE UNIQUE INDEX "LegacyMigrationMap_source_target_key"
  ON "LegacyMigrationMap"("sourceSystem", "sourceDatabase", "sourceTable", "sourceId", "targetModel");

CREATE INDEX "LegacyMigrationMap_runId_disposition_idx"
  ON "LegacyMigrationMap"("runId", "disposition");

CREATE INDEX "LegacyMigrationMap_targetModel_targetId_idx"
  ON "LegacyMigrationMap"("targetModel", "targetId");

CREATE INDEX "LegacyMigrationMap_sourceTable_sourceId_idx"
  ON "LegacyMigrationMap"("sourceTable", "sourceId");

ALTER TABLE "LegacyMigrationMap"
  ADD CONSTRAINT "LegacyMigrationMap_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "LegacyMigrationRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
