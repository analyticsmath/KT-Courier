import { describe, expect, it } from "vitest";
import { assertStoreEarningsProductionReady, STORE_EARNINGS_PRODUCTION_BLOCK_REASON, STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/store-earnings/store-earning-production-readiness";

describe("store earning production readiness", () => {
  it("releases reviewed store earnings without an environment bypass", () => {
    expect(STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED).toBe(true);
    expect(STORE_EARNINGS_PRODUCTION_BLOCK_REASON).toBeNull();
    expect(() => assertStoreEarningsProductionReady()).not.toThrow();
  });
});
