import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { RETENTION_POLICY_REGISTRY } from "@/lib/retention/policy-registry";
import { createRetentionHold, evaluateRetentionHolds, releaseRetentionHold } from "@/lib/retention/hold-evaluator";
import { runRetentionProcessor } from "@/lib/retention/retention-processor";

describe("Phase 5: Retention Processor & Hold Governance", () => {
  const originalUseMem = process.env.PHASE5_REPOSITORY_USE_MEMORY;
  const originalTestMem = process.env.PHASE5_REPOSITORY_TEST_MEMORY;

  beforeEach(() => {
    process.env.PHASE5_REPOSITORY_USE_MEMORY = "true";
    process.env.PHASE5_REPOSITORY_TEST_MEMORY = "true";
  });

  afterEach(() => {
    process.env.PHASE5_REPOSITORY_USE_MEMORY = originalUseMem;
    process.env.PHASE5_REPOSITORY_TEST_MEMORY = originalTestMem;
  });
  it("defines typed policies for required data categories", () => {
    const categories = [
      "EXPIRED_SESSIONS",
      "EXPIRED_EMAIL_OTPS",
      "EXPIRED_DELIVERY_OTPS",
      "EXPIRED_PASSWORD_RESET_TOKENS",
      "EXPIRED_REPORT_ARTIFACTS",
      "PRECISE_DRIVER_LOCATIONS",
      "NOTIFICATION_PROVIDER_PAYLOADS",
      "SECURITY_NETWORK_METADATA",
    ];

    for (const cat of categories) {
      const policy = RETENTION_POLICY_REGISTRY[cat];
      expect(policy).toBeDefined();
      expect(policy.category).toBe(cat);
      expect(policy.actionType).toBeDefined();
      expect(policy.minimumRetentionDays).toBeGreaterThan(0);
    }
  });

  it("evaluates active retention holds correctly", async () => {
    const subjectType = "User";
    const subjectReference = `usr-test-hold-${Date.now()}`;

    // Initially no hold
    const initialEval = await evaluateRetentionHolds({ subjectType, subjectReference });
    expect(initialEval.hasHold).toBe(false);

    // Create active hold
    await createRetentionHold({
      subjectType,
      subjectReference,
      reasonCode: "LEGAL_DISPUTE_INVESTIGATION",
    });

    const activeEval = await evaluateRetentionHolds({ subjectType, subjectReference });
    expect(activeEval.hasHold).toBe(true);
    expect(activeEval.activeHoldReason).toBe("LEGAL_DISPUTE_INVESTIGATION");

    // Release hold
    await releaseRetentionHold({
      subjectType,
      subjectReference,
      actorUserId: "usr-admin",
    });

    const releasedEval = await evaluateRetentionHolds({ subjectType, subjectReference });
    expect(releasedEval.hasHold).toBe(false);
  });

  it("executes retention processor in DRY_RUN mode truthfully without mutations", async () => {
    const summary = await runRetentionProcessor({
      mode: "DRY_RUN",
      batchSize: 10,
    });

    expect(summary.mode).toBe("DRY_RUN");
    expect(summary.policyResults.length).toBeGreaterThan(0);
    expect(summary.itemsCompleted).toBe(0); // Zero mutations in dry run
    expect(summary.safeSummary).toContain("Retention DRY_RUN:");
  });
});
