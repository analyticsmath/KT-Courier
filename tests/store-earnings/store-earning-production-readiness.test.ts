import { describe, expect, it } from "vitest";
import { assertStoreEarningsProductionReady, STORE_EARNINGS_PRODUCTION_BLOCK_REASON, STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/store-earnings/store-earning-production-readiness";

describe("store earning production readiness", () => {
  it("is source-locked with the reviewed block reason", () => {
    expect(STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(STORE_EARNINGS_PRODUCTION_BLOCK_REASON).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");
    expect(() => assertStoreEarningsProductionReady()).toThrow(/consolidated validation/i);
  });
});
