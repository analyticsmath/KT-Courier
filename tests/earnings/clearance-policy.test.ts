import { describe, expect, it } from "vitest";
import { resolveEarningClearance } from "@/lib/earnings/clearance-policy";
const policy = { version: "reviewed-v1", effectiveFrom: "2026-10-15T00:00:00.000Z", storeHoldHours: 48, driverHoldHours: 24, reason: "Reviewed operational settlement risk", submittedByUserId: "author", submittedAt: "2026-10-14T00:00:00.000Z", reviewedByUserId: "reviewer", reviewedAt: "2026-10-14T12:00:00.000Z" };
const now = new Date("2026-10-20T00:00:00.000Z");
const completedAt = new Date("2026-10-16T10:00:00.000Z");
describe("reviewed earning clearance", () => {
  it("derives each hold from actual delivery completion", () => {
    expect(resolveEarningClearance({ policy, kind: "DRIVER", completedAt, now })?.eligibleAt.toISOString()).toBe("2026-10-17T10:00:00.000Z");
    expect(resolveEarningClearance({ policy, kind: "STORE", completedAt, now })?.eligibleAt.toISOString()).toBe("2026-10-18T10:00:00.000Z");
  });
  it.each([null, {}, { ...policy, reviewedAt: null, reviewedByUserId: null }, { ...policy, reviewedByUserId: "author" }, { ...policy, driverHoldHours: -1 }, { ...policy, effectiveFrom: "2026-11-01T00:00:00.000Z" }])("leaves earnings held without valid effective independent review", p => {
    expect(resolveEarningClearance({ policy: p, kind: "DRIVER", completedAt, now })).toBeNull();
  });
  it("never backdates release before activation or review", () => {
    expect(resolveEarningClearance({ policy: { ...policy, driverHoldHours: 0 }, kind: "DRIVER", completedAt: new Date("2026-10-01T00:00:00Z"), now })?.eligibleAt.toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });
  it("rejects future completion evidence", () => {
    expect(resolveEarningClearance({ policy, kind: "DRIVER", completedAt: new Date("2026-11-01T00:00:00Z"), now })).toBeNull();
  });
});
