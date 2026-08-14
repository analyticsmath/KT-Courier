-- Phase B promoter programme closure.  This is deliberately additive: Phase 25
-- remains the sole authority for programme, attribution, earning and withdrawal records.
ALTER TYPE "PromoterProgramTargetType" ADD VALUE IF NOT EXISTS 'DRIVER';
ALTER TYPE "PromoterAttributionSubjectType" ADD VALUE IF NOT EXISTS 'DRIVER';
ALTER TYPE "PromoterQualifyingEventType" ADD VALUE IF NOT EXISTS 'DRIVER_FIRST_COMPLETED_SETTLED_DELIVERY';

CREATE TYPE "PromoterQualificationRuleType" AS ENUM (
  'DIRECT_REFERRAL_COUNT', 'QUALIFIED_TARGET_COUNT', 'MONTHLY_ACTIVITY_COUNT',
  'TEAM_MEMBER_COUNT', 'TEAM_QUALIFIED_COUNT', 'QUALIFYING_TRANSACTION_COUNT',
  'QUALIFYING_REVENUE_AMOUNT'
);
CREATE TYPE "PromoterQualificationEvaluationStatus" AS ENUM ('COMPLETED', 'RECONCILIATION_REQUIRED');

ALTER TABLE "PromoterAttribution" ADD COLUMN "driverProfileId" TEXT;
ALTER TABLE "PromoterProgramVersion" ADD COLUMN "teamRules" JSONB;
ALTER TABLE "PromoterProgramVersion" ADD COLUMN "bonusRules" JSONB;
ALTER TABLE "PromoterAttribution" DROP CONSTRAINT IF EXISTS "PromoterAttribution_one_subject";
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_one_subject"
  CHECK ((CASE WHEN "customerUserId" IS NULL THEN 0 ELSE 1 END +
         CASE WHEN "businessAccountId" IS NULL THEN 0 ELSE 1 END +
         CASE WHEN "storeId" IS NULL THEN 0 ELSE 1 END +
         CASE WHEN "driverProfileId" IS NULL THEN 0 ELSE 1 END) = 1);

CREATE TABLE "PromoterRankDefinition" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "programVersionId" TEXT NOT NULL,
  "code" TEXT NOT NULL, "displayName" TEXT NOT NULL, "rankOrder" INTEGER NOT NULL,
  "qualificationRuleCodes" JSONB NOT NULL, "benefitConfiguration" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoterRankDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PromoterQualificationRule" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "programVersionId" TEXT NOT NULL,
  "code" TEXT NOT NULL, "type" "PromoterQualificationRuleType" NOT NULL,
  "configuration" JSONB NOT NULL, "required" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoterQualificationRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PromoterTeamEdge" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "programVersionId" TEXT NOT NULL,
  "parentPromoterAccountId" TEXT NOT NULL, "childPromoterAccountId" TEXT NOT NULL,
  "attributionId" TEXT, "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveUntil" TIMESTAMP(3), "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "createdByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoterTeamEdge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromoterTeamEdge_parent_not_child" CHECK ("parentPromoterAccountId" <> "childPromoterAccountId")
);
CREATE TABLE "PromoterQualificationEvaluation" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "promoterAccountId" TEXT NOT NULL,
  "programVersionId" TEXT NOT NULL, "periodKey" TEXT NOT NULL,
  "status" "PromoterQualificationEvaluationStatus" NOT NULL DEFAULT 'COMPLETED',
  "qualified" BOOLEAN NOT NULL, "rankDefinitionId" TEXT, "result" JSONB NOT NULL,
  "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoterQualificationEvaluation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromoterQualificationEvaluation_period_format" CHECK ("periodKey" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE UNIQUE INDEX "PromoterRankDefinition_publicReference_key" ON "PromoterRankDefinition"("publicReference");
CREATE UNIQUE INDEX "PromoterRankDefinition_programVersionId_code_key" ON "PromoterRankDefinition"("programVersionId", "code");
CREATE UNIQUE INDEX "PromoterRankDefinition_programVersionId_rankOrder_key" ON "PromoterRankDefinition"("programVersionId", "rankOrder");
CREATE INDEX "PromoterRankDefinition_programVersionId_rankOrder_idx" ON "PromoterRankDefinition"("programVersionId", "rankOrder");
CREATE UNIQUE INDEX "PromoterQualificationRule_publicReference_key" ON "PromoterQualificationRule"("publicReference");
CREATE UNIQUE INDEX "PromoterQualificationRule_programVersionId_code_key" ON "PromoterQualificationRule"("programVersionId", "code");
CREATE INDEX "PromoterQualificationRule_programVersionId_type_idx" ON "PromoterQualificationRule"("programVersionId", "type");
CREATE UNIQUE INDEX "PromoterTeamEdge_publicReference_key" ON "PromoterTeamEdge"("publicReference");
CREATE UNIQUE INDEX "PromoterTeamEdge_operationId_key" ON "PromoterTeamEdge"("operationId");
CREATE UNIQUE INDEX "PromoterTeamEdge_active_child_key" ON "PromoterTeamEdge"("programVersionId", "childPromoterAccountId") WHERE "effectiveUntil" IS NULL;
CREATE INDEX "PromoterTeamEdge_parent_active_idx" ON "PromoterTeamEdge"("programVersionId", "parentPromoterAccountId", "effectiveUntil");
CREATE INDEX "PromoterTeamEdge_child_active_idx" ON "PromoterTeamEdge"("programVersionId", "childPromoterAccountId", "effectiveUntil");
CREATE UNIQUE INDEX "PromoterQualificationEvaluation_publicReference_key" ON "PromoterQualificationEvaluation"("publicReference");
CREATE UNIQUE INDEX "PromoterQualificationEvaluation_operationId_key" ON "PromoterQualificationEvaluation"("operationId");
CREATE UNIQUE INDEX "PromoterQualificationEvaluation_period_key" ON "PromoterQualificationEvaluation"("promoterAccountId", "programVersionId", "periodKey");
CREATE INDEX "PromoterQualificationEvaluation_period_status_idx" ON "PromoterQualificationEvaluation"("programVersionId", "periodKey", "status");

ALTER TABLE "PromoterRankDefinition" ADD CONSTRAINT "PromoterRankDefinition_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterQualificationRule" ADD CONSTRAINT "PromoterQualificationRule_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterTeamEdge" ADD CONSTRAINT "PromoterTeamEdge_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterTeamEdge" ADD CONSTRAINT "PromoterTeamEdge_parentPromoterAccountId_fkey" FOREIGN KEY ("parentPromoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterTeamEdge" ADD CONSTRAINT "PromoterTeamEdge_childPromoterAccountId_fkey" FOREIGN KEY ("childPromoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterTeamEdge" ADD CONSTRAINT "PromoterTeamEdge_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "PromoterAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterQualificationEvaluation" ADD CONSTRAINT "PromoterQualificationEvaluation_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterQualificationEvaluation" ADD CONSTRAINT "PromoterQualificationEvaluation_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterQualificationEvaluation" ADD CONSTRAINT "PromoterQualificationEvaluation_rankDefinitionId_fkey" FOREIGN KEY ("rankDefinitionId") REFERENCES "PromoterRankDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "phase_b_promoter_programme_config_draft_only"() RETURNS trigger AS $$
DECLARE programme_status "PromoterProgramVersionStatus";
BEGIN
  SELECT status INTO programme_status FROM "PromoterProgramVersion" WHERE id = COALESCE(NEW."programVersionId", OLD."programVersionId");
  IF programme_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'promoter programme configuration is immutable outside DRAFT'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PromoterRankDefinition_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "PromoterRankDefinition" FOR EACH ROW EXECUTE FUNCTION "phase_b_promoter_programme_config_draft_only"();
CREATE TRIGGER "PromoterQualificationRule_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "PromoterQualificationRule" FOR EACH ROW EXECUTE FUNCTION "phase_b_promoter_programme_config_draft_only"();

CREATE OR REPLACE FUNCTION "phase_b_promoter_team_edge_acyclic"() RETURNS trigger AS $$
BEGIN
  IF NEW."effectiveUntil" IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    WITH RECURSIVE ancestors(id) AS (
      SELECT edge."parentPromoterAccountId" FROM "PromoterTeamEdge" edge
      WHERE edge."programVersionId" = NEW."programVersionId" AND edge."childPromoterAccountId" = NEW."parentPromoterAccountId"
        AND edge."effectiveUntil" IS NULL AND edge.id <> NEW.id
      UNION
      SELECT edge."parentPromoterAccountId" FROM "PromoterTeamEdge" edge
      JOIN ancestors ON edge."childPromoterAccountId" = ancestors.id
      WHERE edge."programVersionId" = NEW."programVersionId" AND edge."effectiveUntil" IS NULL AND edge.id <> NEW.id
    ) SELECT 1 FROM ancestors WHERE id = NEW."childPromoterAccountId"
  ) THEN RAISE EXCEPTION 'promoter team graph cycle'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PromoterTeamEdge_acyclic" BEFORE INSERT OR UPDATE OF "programVersionId", "parentPromoterAccountId", "childPromoterAccountId", "effectiveUntil" ON "PromoterTeamEdge" FOR EACH ROW EXECUTE FUNCTION "phase_b_promoter_team_edge_acyclic"();
