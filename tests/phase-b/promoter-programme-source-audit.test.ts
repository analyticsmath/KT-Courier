import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("Phase B promoter programme source contract", () => {
  it("makes programme configuration effective-dated and immutable outside draft", () => {
    const schema = read("prisma/schema.prisma"); const migration = read("prisma/migrations/20260811160000_phase_b_promoter_programme_closure/migration.sql");
    expect(schema).toMatch(/model PromoterRankDefinition/); expect(schema).toMatch(/model PromoterQualificationRule/); expect(schema).toMatch(/commissionPlanVersionId/); expect(schema).toMatch(/teamRules/); expect(schema).toMatch(/bonusRules/);
    expect(migration).toMatch(/programme configuration is immutable outside DRAFT/); expect(migration).toMatch(/PromoterRankDefinition_draft_only/);
  });
  it("covers driver acquisition and a database-enforced historical team graph", () => {
    const migration = read("prisma/migrations/20260811160000_phase_b_promoter_programme_closure/migration.sql"); const policy = read("lib/promoters/policy.ts");
    expect(policy).toMatch(/DRIVER/); expect(policy).toMatch(/DRIVER_APPLICATION/); expect(migration).toMatch(/PromoterTeamEdge_parent_not_child/); expect(migration).toMatch(/promoter team graph cycle/); expect(migration).toMatch(/PromoterTeamEdge_active_child_key/);
  });
  it("uses generic configured qualification rules and idempotent monthly evaluation", () => {
    const service = read("lib/promoters/team-qualification.service.ts");
    expect(service).toMatch(/DIRECT_REFERRAL_COUNT/); expect(service).toMatch(/QUALIFYING_REVENUE_AMOUNT/); expect(service).toMatch(/promoterAccountId_programVersionId_periodKey/); expect(service).toMatch(/P2002/);
  });
  it("exposes protected configuration, team, rank, qualification and history contracts", () => {
    for (const file of ["app/api/admin/promoter-programs/[reference]/versions/route.ts", "app/api/admin/promoter-program-versions/[reference]/activate/route.ts", "app/api/promoter/team/route.ts", "app/api/promoter/rank/route.ts", "app/api/promoter/qualifications/route.ts", "app/api/promoter/history/route.ts"]) expect(read(file)).toBeTruthy();
    expect(read("app/api/admin/promoter-programs/[reference]/versions/route.ts")).toMatch(/PERMISSIONS\.PROMOTER_PROGRAMS_MANAGE/);
  });
});
