import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Phase 27 executable source-authority audit", () => {
  it("proves only canonical Phase 27 code can own production email, SMS, or push delivery", () => {
    const raw = execFileSync(process.execPath, ["scripts/audit-phase27-notification-authority.mjs"], { cwd: process.cwd(), encoding: "utf8" });
    const report = JSON.parse(raw) as { summary: Record<string, number>; matches: { classification: string }[]; productionDeliveryAuthority: Record<string, string> };
    expect(report.summary.FORBIDDEN_PRODUCTION_SENDER).toBe(0);
    expect(report.productionDeliveryAuthority).toEqual({ email: "Phase 27 canonical notification authority", sms: "Phase 27 canonical notification authority", push: "Phase 27 canonical notification authority" });
    expect(report.matches.every((match) => ["CANONICAL_PHASE27", "SECURITY_EVENT_PRODUCER", "TEST_ONLY", "DOCUMENTATION_ONLY"].includes(match.classification))).toBe(true);
  });
});
