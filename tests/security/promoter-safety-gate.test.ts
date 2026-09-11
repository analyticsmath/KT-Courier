/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import {
  PROMOTERS_PRODUCTION_VALIDATION_APPROVED,
  PROMOTERS_PRODUCTION_BLOCK_REASON,
  assertPromotersProductionReady,
} from "@/lib/promoters/production-readiness";
import { resolvePromoterProductionComposition } from "@/lib/promoters/composition-root";
import { bindPromoterAttribution } from "@/lib/promoters/qualification-earning.service";
import { PromoterTeamQualificationService } from "@/lib/promoters/team-qualification.service";
import { PromoterLifecycleService } from "@/lib/promoters/lifecycle.service";
import { scanPromoterReconciliation } from "@/lib/promoters/promoter-reconciliation.service";
import { PROCESSOR_REGISTRY } from "@/lib/processors/processor-registry";

describe("Phase 1: Promoter Production Safety Gate Invariant", () => {
  it("has PROMOTERS_PRODUCTION_VALIDATION_APPROVED strictly hardcoded to false", () => {
    expect(PROMOTERS_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(PROMOTERS_PRODUCTION_BLOCK_REASON).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");
  });

  it("assertPromotersProductionReady throws PROMOTER_PRODUCTION_LOCKED unconditionally", () => {
    expect(() => assertPromotersProductionReady()).toThrowError(
      /Promoter operations are inactive pending CONSOLIDATED_VALIDATION_NOT_APPROVED/i,
    );
  });

  it("composition root reports LOCKED status and does not activate services", () => {
    const root = resolvePromoterProductionComposition();
    expect(root.status).toBe("LOCKED");
    if (root.status === "LOCKED") {
      expect(root.code).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");
    }
  });

  it("fails closed across all 5 promoter money & qualification boundaries", async () => {
    const dummyDb = {} as any;

    // Boundary 1: Qualification Earning Service (Attribution Binding)
    await expect(bindPromoterAttribution(dummyDb, {} as any)).rejects.toThrowError(
      /CONSOLIDATED_VALIDATION_NOT_APPROVED/,
    );

    // Boundary 2: Team Qualification Service
    const teamService = new PromoterTeamQualificationService(dummyDb);
    await expect(teamService.team("prog_1", "acc_1")).rejects.toThrowError(
      /CONSOLIDATED_VALIDATION_NOT_APPROVED/,
    );

    // Boundary 3: Promoter Lifecycle Service
    const lifecycleService = new PromoterLifecycleService(dummyDb);
    await expect(lifecycleService.submitPromoterApplication({} as any)).rejects.toThrowError(
      /CONSOLIDATED_VALIDATION_NOT_APPROVED/,
    );

    // Boundary 4: Promoter Reconciliation Service
    await expect(scanPromoterReconciliation(dummyDb, {} as any)).rejects.toThrowError(
      /CONSOLIDATED_VALIDATION_NOT_APPROVED/,
    );

    // Boundary 5: Processor Registry disabled invariant
    const promoterProcessor = PROCESSOR_REGISTRY["process-promoter-qualifications"];
    expect(promoterProcessor).toBeDefined();
    expect(promoterProcessor.status).toBe("DISABLED");
  });
});
