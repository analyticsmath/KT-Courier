import { describe, expect, it } from "vitest";
import { getIntegrationRegistry, getReadinessLockRegistry } from "@/lib/security/integration-registry";

describe("Integration Registry Truthfulness", () => {
  it("contains no ambiguous PARTIAL readiness states", () => {
    const registry = getIntegrationRegistry();

    for (const record of registry) {
      expect(record.readiness).not.toBe("PARTIAL");
      expect([
        "LIVE_READY",
        "SANDBOX_READY",
        "MOCK_READY",
        "CREDENTIAL_PENDING",
        "ACTIVATION_PENDING",
        "DISABLED",
        "NOT_IMPLEMENTED",
      ]).toContain(record.readiness);
    }
  });

  it("projects consistent readiness lock records", () => {
    const locks = getReadinessLockRegistry();
    expect(locks.length).toBeGreaterThan(0);

    for (const lock of locks) {
      expect([
        "READY",
        "SOURCE_COMPLETE_FINAL_VALIDATION_PENDING",
        "CREDENTIAL_PENDING",
        "INFRASTRUCTURE_PENDING",
        "PROVIDER_APPROVAL_PENDING",
        "DISABLED_BY_POLICY",
        "DEGRADED",
        "UNAVAILABLE",
      ]).toContain(lock.state);
    }
  });
});
