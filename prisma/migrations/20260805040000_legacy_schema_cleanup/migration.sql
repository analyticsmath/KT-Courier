-- Gate 3 residual legacy schema drift cleanup.
--
-- Resolves residual schema drift for ApplicationDocument, ApplicationStatusHistory,
-- ExportFormat, and WithdrawalStatus_legacy_phase4 via narrow forward-only migration.

-- -----------------------------------------------------------------------------
-- 1. ApplicationDocument preflight & table resolution
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'LegacyApplicationDocument'
  ) THEN
    -- Verify source rows meet integrity requirements before rename/mapping
    IF EXISTS (
      SELECT 1 FROM "LegacyApplicationDocument" doc
      LEFT JOIN "LegacyRecruitmentApplication" app ON app."id" = doc."applicationId"
      WHERE app."id" IS NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Legacy schema cleanup blocked: LegacyApplicationDocument contains rows with missing or invalid applicationId references.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM "LegacyApplicationDocument" doc
      LEFT JOIN "User" u ON u."id" = doc."reviewedByUserId"
      WHERE doc."reviewedByUserId" IS NOT NULL AND u."id" IS NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Legacy schema cleanup blocked: LegacyApplicationDocument contains rows with invalid reviewedByUserId references.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'ApplicationDocument'
    ) THEN
      ALTER TABLE "LegacyApplicationDocument" RENAME TO "ApplicationDocument";
      ALTER INDEX IF EXISTS "LegacyApplicationDocument_pkey" RENAME TO "ApplicationDocument_pkey";
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");
CREATE INDEX IF NOT EXISTS "ApplicationDocument_documentType_idx" ON "ApplicationDocument"("documentType");
CREATE INDEX IF NOT EXISTS "ApplicationDocument_status_idx" ON "ApplicationDocument"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND constraint_name = 'ApplicationDocument_applicationId_fkey'
  ) THEN
    ALTER TABLE "ApplicationDocument" 
      ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" 
      FOREIGN KEY ("applicationId") REFERENCES "LegacyRecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND constraint_name = 'ApplicationDocument_reviewedByUserId_fkey'
  ) THEN
    ALTER TABLE "ApplicationDocument" 
      ADD CONSTRAINT "ApplicationDocument_reviewedByUserId_fkey" 
      FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. ApplicationStatusHistory preflight & table resolution
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'LegacyApplicationStatusHistory'
  ) THEN
    -- Verify source rows meet integrity requirements before rename/mapping
    IF EXISTS (
      SELECT 1 FROM "LegacyApplicationStatusHistory" hist
      LEFT JOIN "LegacyRecruitmentApplication" app ON app."id" = hist."applicationId"
      WHERE app."id" IS NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Legacy schema cleanup blocked: LegacyApplicationStatusHistory contains rows with missing or invalid applicationId references.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM "LegacyApplicationStatusHistory" hist
      LEFT JOIN "User" u ON u."id" = hist."changedByUserId"
      WHERE hist."changedByUserId" IS NOT NULL AND u."id" IS NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Legacy schema cleanup blocked: LegacyApplicationStatusHistory contains rows with invalid changedByUserId references.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'ApplicationStatusHistory'
    ) THEN
      ALTER TABLE "LegacyApplicationStatusHistory" RENAME TO "ApplicationStatusHistory";
      ALTER INDEX IF EXISTS "LegacyApplicationStatusHistory_pkey" RENAME TO "ApplicationStatusHistory_pkey";
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "RecruitmentApplicationStatus",
    "toStatus" "RecruitmentApplicationStatus" NOT NULL,
    "note" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicationStatusHistory_applicationId_idx" ON "ApplicationStatusHistory"("applicationId");
CREATE INDEX IF NOT EXISTS "ApplicationStatusHistory_toStatus_idx" ON "ApplicationStatusHistory"("toStatus");
CREATE INDEX IF NOT EXISTS "ApplicationStatusHistory_changedByUserId_idx" ON "ApplicationStatusHistory"("changedByUserId");
CREATE INDEX IF NOT EXISTS "ApplicationStatusHistory_createdAt_idx" ON "ApplicationStatusHistory"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND constraint_name = 'ApplicationStatusHistory_applicationId_fkey'
  ) THEN
    ALTER TABLE "ApplicationStatusHistory" 
      ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" 
      FOREIGN KEY ("applicationId") REFERENCES "LegacyRecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND constraint_name = 'ApplicationStatusHistory_changedByUserId_fkey'
  ) THEN
    ALTER TABLE "ApplicationStatusHistory" 
      ADD CONSTRAINT "ApplicationStatusHistory_changedByUserId_fkey" 
      FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Obsolete enum dependency preflight & removal
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  export_format_deps INTEGER;
  withdrawal_status_deps INTEGER;
BEGIN
  -- Verify no table columns depend on ExportFormat
  SELECT COUNT(*)::INTEGER INTO export_format_deps
  FROM (
    SELECT 1 FROM information_schema.columns WHERE udt_name = 'ExportFormat'
    UNION ALL
    SELECT 1 FROM pg_type t
    JOIN pg_depend d ON d.refobjid = t.oid
    WHERE t.typname = 'ExportFormat'
      AND d.deptype NOT IN ('i')
  ) AS deps;

  IF export_format_deps > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Legacy schema cleanup blocked: Cannot remove enum ExportFormat because dependencies remain.';
  END IF;

  -- Verify no table columns depend on WithdrawalStatus_legacy_phase4
  SELECT COUNT(*)::INTEGER INTO withdrawal_status_deps
  FROM (
    SELECT 1 FROM information_schema.columns WHERE udt_name = 'WithdrawalStatus_legacy_phase4'
    UNION ALL
    SELECT 1 FROM pg_type t
    JOIN pg_depend d ON d.refobjid = t.oid
    WHERE t.typname = 'WithdrawalStatus_legacy_phase4'
      AND d.deptype NOT IN ('i')
  ) AS deps;

  IF withdrawal_status_deps > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Legacy schema cleanup blocked: Cannot remove enum WithdrawalStatus_legacy_phase4 because dependencies remain.';
  END IF;
END $$;

DROP TYPE "ExportFormat";
DROP TYPE "WithdrawalStatus_legacy_phase4";
