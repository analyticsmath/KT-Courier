import { describe, it, expect, afterEach, vi } from "vitest";
import { detectServerActions } from "../../lib/security/server-action-detector";
import { InMemoryRateLimitStore } from "../../lib/security/distributed-rate-limit";
import { assertSeedExecutionAllowed, SeedSafetyError } from "../../lib/security/seed-safety";
import { getIntegrationRegistry } from "../../lib/security/integration-registry";

describe("Phase 1B-C — Architectural Verification & Governance", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  describe("Workstream 2 — AST Server Action Detector Fixtures", () => {
    it("should detect file-level double-quoted 'use server' directive", () => {
      const code = `"use server";\nexport async function myAction() {}`;
      const res = detectServerActions(code);
      expect(res.isFileDirective).toBe(true);
      expect(res.actions.length).toBe(1);
      expect(res.actions[0]?.name).toBe("myAction");
    });

    it("should detect file-level single-quoted 'use server' directive", () => {
      const code = `'use server';\nexport async function myAction() {}`;
      const res = detectServerActions(code);
      expect(res.isFileDirective).toBe(true);
      expect(res.actions.length).toBe(1);
      expect(res.actions[0]?.name).toBe("myAction");
    });

    it("should detect function-level 'use server' directive", () => {
      const code = `export async function inlineAction() {\n  "use server";\n  return 42;\n}`;
      const res = detectServerActions(code);
      expect(res.isFileDirective).toBe(false);
      expect(res.actions.length).toBe(1);
      expect(res.actions[0]?.name).toBe("inlineAction");
      expect(res.actions[0]?.scope).toBe("function");
    });

    it("should detect directive after leading comments", () => {
      const code = `// Leading comment\n/* Block comment */\n"use server";\nexport async function commentAction() {}`;
      const res = detectServerActions(code);
      expect(res.isFileDirective).toBe(true);
      expect(res.actions.length).toBe(1);
      expect(res.actions[0]?.name).toBe("commentAction");
    });

    it("should NOT detect directive inside comments", () => {
      const code = `// "use server" is cool\nexport async function normalHelper() {}`;
      const res = detectServerActions(code);
      expect(res.isFileDirective).toBe(false);
      expect(res.actions.length).toBe(0);
    });

    it("should NOT detect directive inside regular string literals", () => {
      const code = `const msg = "Please use server mode";\nexport async function helper() {}`;
      const res = detectServerActions(code);
      expect(res.isFileDirective).toBe(false);
      expect(res.actions.length).toBe(0);
    });
  });

  describe("Workstream 5 — Distributed Rate Limiting & Failure Policy", () => {
    it("should include warning metadata when operating in-memory in production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const store = new InMemoryRateLimitStore();
      const decision = await store.consume({
        key: "login:127.0.0.1",
        policy: { max: 5, windowMs: 60000 },
      });

      expect(decision.accepted).toBe(true);
      expect(decision.warning).toContain("Production environment operating process-memory rate limiter");
    });
  });

  describe("Workstream 6 — Integration Readiness Classifications", () => {
    it("should classify incomplete launch-scope capabilities as CREDENTIAL_PENDING or PARTIAL", () => {
      const registry = getIntegrationRegistry();
      const sms = registry.find((r) => r.id === "sms-notifications");
      const wa = registry.find((r) => r.id === "whatsapp-notifications");
      const push = registry.find((r) => r.id === "push-notifications");

      expect(sms?.readiness).toBe("PARTIAL");
      expect(wa?.readiness).toBe("PARTIAL");
      expect(push?.readiness).toBe("PARTIAL");
      expect(sms?.productionEligible).toBe(false);
    });
  });

  describe("Workstream 10 — Seed Safety Complete Matrix", () => {
    it("should reject staging database classification by default", () => {
      expect(() =>
        assertSeedExecutionAllowed({ nodeEnv: "development", classification: "staging", allowDemoSeed: "true" })
      ).toThrowError(SeedSafetyError);
    });

    it("should reject ambiguous database classification", () => {
      expect(() =>
        assertSeedExecutionAllowed({ nodeEnv: "development", classification: "invalid_env", allowDemoSeed: "true" })
      ).toThrowError(SeedSafetyError);
    });
  });
});
