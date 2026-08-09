import { afterEach, describe, expect, it, vi } from "vitest";
import {
  withdrawalProductionReadiness,
  assertWithdrawalProductionActivation,
  WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED,
  WITHDRAWAL_PRODUCTION_BLOCK_REASON,
} from "@/lib/withdrawals/withdrawal-production-readiness";

describe("withdrawal production readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps production fail-closed before consolidated validation approval", () => {
    expect(WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(WITHDRAWAL_PRODUCTION_BLOCK_REASON).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");

    vi.stubEnv("NODE_ENV", "production");
    const readiness = withdrawalProductionReadiness();
    expect(readiness.productionActive).toBe(false);
    expect(readiness.blockReason).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");

    expect(() => assertWithdrawalProductionActivation()).toThrowError(/locked pending/);

    vi.stubEnv("NODE_ENV", "development");
    const devReadiness = withdrawalProductionReadiness();
    expect(devReadiness.productionActive).toBe(true);
    expect(() => assertWithdrawalProductionActivation()).not.toThrow();
  });
});
