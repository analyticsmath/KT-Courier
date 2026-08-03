import { describe, expect, it } from "vitest";
import { DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER, resolveDeveloperApiProductionComposition } from "@/lib/developer-api/composition-root";
import { DEVELOPER_API_PRODUCTION_LOCK_REASON } from "@/lib/developer-api/contracts";

describe("Phase 28 production composition", () => {
  it("constructs concrete repositories before the irreversible readiness lock", () => {
    expect(DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER).toEqual(expect.arrayContaining(["concrete Prisma developer repositories", "credential keyed-hash authority", "rate-limit service", "quota service", "canonical source-event adapters", "webhook public-projection adapters", "webhook delivery service", "readiness assertion"]));
    expect(DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER.indexOf("concrete Prisma developer repositories")).toBeLessThan(DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER.indexOf("readiness assertion"));
    const composition = resolveDeveloperApiProductionComposition();
    expect(composition.status).toBe("LOCKED");
    expect(composition).toMatchObject({ code: DEVELOPER_API_PRODUCTION_LOCK_REASON });
    expect(composition.services.rateLimits).toBeTruthy();
    expect(composition.services.quotas).toBeTruthy();
    expect(composition.services.projections).toBeTruthy();
  });
});
