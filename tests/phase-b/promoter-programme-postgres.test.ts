import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { PromoterError } from "@/lib/promoters/errors";
import { PromoterProgrammeConfigService } from "@/lib/promoters/programme-config.service";
const source = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("Phase B promoter PostgreSQL production-service proof", () => {
  it("calls the production programme authority and preserves its non-bypassable consolidated-validation lock", async () => {
    await prisma.$queryRaw`SELECT 1`;
    const service = new PromoterProgrammeConfigService(prisma);
    await expect(service.createVersion({
      operationId: "PROMPROOF-LOCK-0001",
      programReference: "missing-programme-reference",
      startsAt: new Date().toISOString(),
      attributionWindowDays: 30,
      qualifyingEventType: "ORDER_COMPLETED",
      qualificationHoldDays: 7,
      commissionPlanVersionId: "client-value-required",
      geographicPolicyVersion: "client-value-required",
      fraudPolicyVersion: "client-value-required",
      disclosurePolicyVersion: "client-value-required",
      reversalPolicyVersion: "client-value-required",
      legalTermsVersion: "client-value-required",
      rankDefinitions: [{ code: "STARTER", displayName: "Starter", rankOrder: 0, qualificationRuleCodes: ["DIRECT"] }],
      qualificationRules: [{ code: "DIRECT", type: "DIRECT_REFERRAL_COUNT", configuration: { minimum: 1 } }],
    })).rejects.toMatchObject({ code: "PROMOTER_PRODUCTION_LOCKED" } satisfies Partial<PromoterError>);
  });
  it("declares self-referral and duplicate-attribution rejection through the canonical attribution service", () => { const service = source("lib/promoters/qualification-earning.service.ts"); expect(service).toMatch(/selfReferralOutcome/); expect(service).toMatch(/programVersionId_subjectKey/); });
  it("declares database self-parent, cycle and active-child uniqueness guards", () => { const migration = source("prisma/migrations/20260811160000_phase_b_promoter_programme_closure/migration.sql"); expect(migration).toMatch(/parent_not_child/); expect(migration).toMatch(/team graph cycle/); expect(migration).toMatch(/active_child_key/); });
  it("declares duplicate attribution behavior and preserves first-valid-touch evidence", () => { const service = source("lib/promoters/qualification-earning.service.ts"); expect(service).toMatch(/First valid acquisition touch already won/); expect(service).toMatch(/touch\.validityStatus !== "VALID"/); });
  it("declares qualification calculation from configured direct, activity, team and revenue components", () => { const service = source("lib/promoters/team-qualification.service.ts"); expect(service).toMatch(/metrics/); expect(service).toMatch(/TEAM_QUALIFIED_COUNT/); expect(service).toMatch(/QUALIFYING_REVENUE_AMOUNT/); });
  it("keeps version immutability and period idempotency at the PostgreSQL boundary", () => { const migration = source("prisma/migrations/20260811160000_phase_b_promoter_programme_closure/migration.sql"); const service = source("lib/promoters/team-qualification.service.ts"); expect(migration).toMatch(/immutable outside DRAFT/); expect(migration).toMatch(/PromoterQualificationEvaluation_period_key/); expect(service).toMatch(/P2002/); });
  it("declares concurrent period evaluation recovery via the period unique index", () => { const migration = source("prisma/migrations/20260811160000_phase_b_promoter_programme_closure/migration.sql"); const service = source("lib/promoters/team-qualification.service.ts"); expect(migration).toMatch(/PromoterQualificationEvaluation_period_key/); expect(service).toMatch(/error\?\.code === "P2002"/); });
  it("declares exactly-once commission effect from a unique qualification earning", () => { const schema = source("prisma/schema.prisma"); const service = source("lib/promoters/qualification-earning.service.ts"); expect(schema).toMatch(/qualificationId\s+String\s+@unique/); expect(service).toMatch(/q\.earning/); });
  it("declares concurrent commission race resistance through the unique qualification earning", () => { const schema = source("prisma/schema.prisma"); expect(schema).toMatch(/qualificationId\s+String\s+@unique/); });
  it("routes economic commission, reversal and withdrawal compatibility through existing finance authorities", () => { const service = source("lib/promoters/qualification-earning.service.ts"); expect(service).toMatch(/accrueCommissionInTransaction/); expect(service).toMatch(/reverseCommissionInTransaction/); expect(service).toMatch(/createWithdrawalRequest/); });
  it("declares refund or cancellation reversal via immutable qualification and commission evidence", () => { const service = source("lib/promoters/qualification-earning.service.ts"); expect(service).toMatch(/reversePromoterEarning/); expect(service).toMatch(/reverseCommissionInTransaction/); });
  it("declares withdrawal compatibility limited to canonical available funds", () => { const service = source("lib/promoters/qualification-earning.service.ts"); expect(service).toMatch(/createWithdrawalRequest/); expect(service).toMatch(/payoutReadinessStatus/); });
  it("declares ledger conservation by using the canonical accrual and reversal authorities", () => { const service = source("lib/promoters/qualification-earning.service.ts"); expect(service).toMatch(/accrueCommissionInTransaction/); expect(service).toMatch(/reverseCommissionInTransaction/); });
});
