import { describe, expect, it } from "vitest";
import { assertHistoricalScopeRecoverySafe, HISTORICAL_SCOPE_MIGRATION, isKnownHistoricalScopeFailure } from "@/lib/migrations/marketplace-history-recovery";
const failure = { migration_name: HISTORICAL_SCOPE_MIGRATION, logs: "ERROR: column p.publicReference does not exist", applied_steps_count: 0 };
describe("bounded historical migration recovery", () => {
  it("recognizes only the observed failure before backfill", () => {
    expect(isKnownHistoricalScopeFailure(failure)).toBe(true);
    expect(isKnownHistoricalScopeFailure({ ...failure, migration_name: "different" })).toBe(false);
    expect(isKnownHistoricalScopeFailure({ ...failure, logs: "unrelated database error" })).toBe(false);
    expect(isKnownHistoricalScopeFailure({ ...failure, applied_steps_count: 1 })).toBe(false);
  });
  it("allows no change or only untouched additive columns", () => {
    expect(() => assertHistoricalScopeRecoverySafe(0, 0, false)).not.toThrow();
    expect(() => assertHistoricalScopeRecoverySafe(2, 0, false)).not.toThrow();
  });
  it("refuses partial columns, changed origins, or a later-stage guard", () => {
    expect(() => assertHistoricalScopeRecoverySafe(1, 0, false)).toThrow();
    expect(() => assertHistoricalScopeRecoverySafe(2, 1, false)).toThrow();
    expect(() => assertHistoricalScopeRecoverySafe(2, 0, true)).toThrow();
  });
});
