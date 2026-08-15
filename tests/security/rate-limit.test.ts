import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  resolveRateLimitPolicy,
  clearRateLimitStoreForTesting,
  RATE_LIMITS,
} from "../../lib/security/rate-limit";
import { DELIVERY_OTP_POLICY, isOtpLocked } from "../../lib/driver-operations/otp-policy";

describe("Rate Limiting Security & Policy Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    clearRateLimitStoreForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearRateLimitStoreForTesting();
  });

  it("proves public environment flags cannot relax limits", async () => {
    // Set public E2E deterministic coordinates flag, but no server-only flags
    process.env.NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES = "true";
    delete process.env.KT_RUNTIME_ENV;
    delete process.env.KT_E2E_RATE_LIMIT_MODE;

    // Normal policy (e.g. LOGIN max=10)
    const policy = resolveRateLimitPolicy(RATE_LIMITS.LOGIN);
    expect(policy.max).toBe(RATE_LIMITS.LOGIN.max);

    // Limit must still trigger at normal limit
    const key = "test-public-flag-ip";
    for (let i = 0; i < RATE_LIMITS.LOGIN.max; i++) {
      const res = await checkRateLimit(key, RATE_LIMITS.LOGIN);
      expect(res.ok).toBe(true);
    }
    const failRes = await checkRateLimit(key, RATE_LIMITS.LOGIN);
    expect(failRes.ok).toBe(false);
    expect(failRes.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("proves one server-only flag is insufficient to relax limits", () => {
    // Only KT_RUNTIME_ENV set
    process.env.KT_RUNTIME_ENV = "e2e";
    delete process.env.KT_E2E_RATE_LIMIT_MODE;

    let policy = resolveRateLimitPolicy(RATE_LIMITS.LOGIN);
    expect(policy.max).toBe(RATE_LIMITS.LOGIN.max);

    // Only KT_E2E_RATE_LIMIT_MODE set
    delete process.env.KT_RUNTIME_ENV;
    process.env.KT_E2E_RATE_LIMIT_MODE = "relaxed";

    policy = resolveRateLimitPolicy(RATE_LIMITS.LOGIN);
    expect(policy.max).toBe(RATE_LIMITS.LOGIN.max);
  });

  it("proves both server-only flags activate the finite E2E policy", () => {
    // Both server-only flags are set
    process.env.KT_RUNTIME_ENV = "e2e";
    process.env.KT_E2E_RATE_LIMIT_MODE = "relaxed";

    const policy = resolveRateLimitPolicy(RATE_LIMITS.LOGIN);
    // E2E finite limit is 10000
    expect(policy.max).toBe(10000);
  });

  it("proves normal production policy remains unchanged", () => {
    // No env variables set (production-like)
    delete process.env.KT_RUNTIME_ENV;
    delete process.env.KT_E2E_RATE_LIMIT_MODE;
    delete process.env.NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES;

    const policy = resolveRateLimitPolicy(RATE_LIMITS.LOGIN);
    expect(policy.max).toBe(RATE_LIMITS.LOGIN.max);
  });

  it("proves E2E policy remains finite", () => {
    process.env.KT_RUNTIME_ENV = "e2e";
    process.env.KT_E2E_RATE_LIMIT_MODE = "relaxed";

    const policy = resolveRateLimitPolicy(RATE_LIMITS.LOGIN);
    expect(policy.max).toBe(10000); // 10000 is high but finite
  });

  it("proves E2E requests still increment limiter state", async () => {
    process.env.KT_RUNTIME_ENV = "e2e";
    process.env.KT_E2E_RATE_LIMIT_MODE = "relaxed";

    const key = "e2e-increment-test-key";
    
    // Perform a request
    const firstRes = await checkRateLimit(key, RATE_LIMITS.LOGIN);
    expect(firstRes.ok).toBe(true);

    // We can prove it increments by changing the E2E flags back to production mid-flight
    // and verifying that the count has indeed been recorded and now hits the normal limit.
    // For LOGIN, the limit is 10. Let's do 9 requests under E2E:
    for (let i = 1; i < 9; i++) {
      const res = await checkRateLimit(key, RATE_LIMITS.LOGIN);
      expect(res.ok).toBe(true);
    }

    // Now disable E2E relaxed mode to trigger normal limits (max=10).
    // The key already has 9 timestamps.
    delete process.env.KT_RUNTIME_ENV;
    delete process.env.KT_E2E_RATE_LIMIT_MODE;

    // The 10th request should succeed.
    const tenthRes = await checkRateLimit(key, RATE_LIMITS.LOGIN);
    expect(tenthRes.ok).toBe(true);

    // The 11th request must fail because we now have 10 requests stored.
    const eleventhRes = await checkRateLimit(key, RATE_LIMITS.LOGIN);
    expect(eleventhRes.ok).toBe(false);
  });

  it("proves OTP persisted attempt limits remain entirely independent of rate-limit configs", () => {
    const envCombinations = [
      { runtime: "e2e", mode: "relaxed", coords: "true" },
      { runtime: undefined, mode: undefined, coords: undefined },
      { runtime: "e2e", mode: undefined, coords: undefined },
      { runtime: undefined, mode: "relaxed", coords: undefined },
      { runtime: undefined, mode: undefined, coords: "true" },
    ];

    for (const combo of envCombinations) {
      if (combo.runtime) process.env.KT_RUNTIME_ENV = combo.runtime;
      else delete process.env.KT_RUNTIME_ENV;

      if (combo.mode) process.env.KT_E2E_RATE_LIMIT_MODE = combo.mode;
      else delete process.env.KT_E2E_RATE_LIMIT_MODE;

      if (combo.coords) process.env.NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES = combo.coords;
      else delete process.env.NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES;

      // OTP limits must not change
      expect(DELIVERY_OTP_POLICY.maxAttempts).toBe(5);
      expect(isOtpLocked(5, DELIVERY_OTP_POLICY.maxAttempts)).toBe(true);
      expect(isOtpLocked(4, DELIVERY_OTP_POLICY.maxAttempts)).toBe(false);
    }
  });
});
