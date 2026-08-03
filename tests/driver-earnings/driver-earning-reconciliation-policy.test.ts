import { expect, it } from "vitest";
import { DRIVER_EARNING_RECONCILIATION_REASONS, mayResolveDriverEarningReconciliation } from "@/lib/driver-earnings/driver-earning-reconciliation-policy";
it("defines all twenty reasons", () => expect(DRIVER_EARNING_RECONCILIATION_REASONS).toHaveLength(20));
it("requires restored invariant and canonical reference", () => expect(mayResolveDriverEarningReconciliation({ financialInvariantRestored: true, canonicalOperationReference: "DE-JOURNAL-1" })).toBe(true));
