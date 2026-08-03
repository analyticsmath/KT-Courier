import { describe, expect, it } from "vitest";
import { isOpenStoreEarningReconciliation, mayResolveStoreEarningReconciliation } from "@/lib/store-earnings/store-earning-reconciliation-policy";

describe("store earning reconciliation policy", () => {
  it.each(["OPEN", "MONITORING"])("treats %s as release-blocking", (status) => expect(isOpenStoreEarningReconciliation(status)).toBe(true));
  it("requires restored evidence plus a canonical operation", () => {
    expect(mayResolveStoreEarningReconciliation({ financialInvariantRestored: true, canonicalOperationReference: "LJ-1" })).toBe(true);
    expect(mayResolveStoreEarningReconciliation({ financialInvariantRestored: true })).toBe(false);
  });
});
