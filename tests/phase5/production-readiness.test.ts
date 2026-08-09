import { describe, expect, it } from "vitest";
import { evaluateProductionConfiguration } from "@/lib/config/production-validation";
import { getHealthPayload } from "@/lib/health/checks";
import { getReadinessLockRegistry, type ReadinessLockState } from "@/lib/security/integration-registry";

const productionBase = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://service:password@db.internal.example/kt_courier",
  NEXT_PUBLIC_APP_URL: "https://app.ktcouriers.example",
  REDIS_URL: "redis://cache.internal.example:6379/0",
  REPORT_ARTIFACT_STORAGE: "object",
  CHECKOUT_PUBLIC_ENABLED: "false",
  PAYFAST_MODE: "disabled",
};

describe("Phase 5 production readiness", () => {
  it("rejects placeholder or local production database configuration without disclosing it", () => {
    const assessment = evaluateProductionConfiguration({ ...productionBase, DATABASE_URL: "postgresql://USER:PASSWORD@localhost:5432/app" });
    expect(assessment.startupBlocked).toBe(true);
    expect(assessment.issues).toContainEqual(expect.objectContaining({ capability: "database", reasonCode: "DATABASE_URL_UNSAFE", blocks: "STARTUP" }));
    expect(JSON.stringify(assessment)).not.toContain("PASSWORD");
  });

  it("rejects deterministic and test-only runtime flags in production", () => {
    const assessment = evaluateProductionConfiguration({ ...productionBase, E2E_ROUTE_PROVIDER: "deterministic" });
    expect(assessment.issues).toContainEqual(expect.objectContaining({ reasonCode: "TEST_BYPASS_ENABLED", blocks: "STARTUP" }));
  });

  it("does not block unrelated readiness when optional email delivery is disabled", () => {
    const assessment = evaluateProductionConfiguration({ ...productionBase, EMAIL_PROVIDER: "console" });
    expect(assessment.startupBlocked).toBe(false);
    expect(assessment.readinessBlocked).toBe(false);
    expect(assessment.issues).toContainEqual(expect.objectContaining({ capability: "transactional_email", blocks: "NONE" }));
  });

  it("uses only the canonical readiness-lock state vocabulary", () => {
    const allowed: ReadinessLockState[] = ["READY", "SOURCE_COMPLETE_FINAL_VALIDATION_PENDING", "CREDENTIAL_PENDING", "INFRASTRUCTURE_PENDING", "PROVIDER_APPROVAL_PENDING", "DISABLED_BY_POLICY", "DEGRADED", "UNAVAILABLE"];
    for (const record of getReadinessLockRegistry()) expect(allowed).toContain(record.state);
  });

  it("does not disclose configuration in liveness output", () => {
    const health = getHealthPayload();
    expect(health).toEqual(expect.objectContaining({ status: "ok", service: "kt-couriers" }));
    expect(JSON.stringify(health)).not.toContain("environment");
    expect(JSON.stringify(health)).not.toContain("DATABASE_URL");
  });
});
