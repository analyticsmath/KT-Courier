import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const operations = ["preflight", "close-expired-openings", "expire-draft-applications", "process-screening-flags", "expire-offers", "process-onboarding-handoffs", "process-retention", "scan-fraud", "scan-reconciliation", "verify-invariants", "launch-integration-suite"];

describe("Phase 26 processor manifest and lock", () => {
  it("maps all eleven required operations to executable scripts and canonical handlers", async () => {
    const manifest = await import("../../scripts/phase26-processor-cli.mjs");
    expect(Object.keys(manifest.PHASE26_PROCESSORS)).toEqual(operations);
    for (const operation of operations) {
      expect(fs.existsSync(path.join(root, `scripts/phase26-${operation}.mjs`))).toBe(true);
      const proc = (manifest.PHASE26_PROCESSORS as Record<string, any>)[operation];
      expect(proc.handler).toBeTruthy();
      expect(proc.service).toBeTruthy();
    }
  });

  it("defaults to dry-run and remains locked for --apply with deterministic operation identifiers", () => {
    const script = path.join(root, "scripts/phase26-close-expired-openings.mjs");
    const dryRun = execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    const apply = execFileSync(process.execPath, [script, "--apply", "--limit", "5"], { cwd: root, encoding: "utf8" });
    expect(dryRun).toContain('"apply":false');
    expect(apply).toContain('"apply":true');
    expect(apply).toContain('"status":"LOCKED"');
    expect(dryRun).toMatch(/"operationId":"phase26:close-expired-openings:\d{4}-\d{2}-\d{2}"/);
  });

  it("rejects invalid processor limits before composing a mutation", () => {
    const script = path.join(root, "scripts/phase26-close-expired-openings.mjs");
    expect(() => execFileSync(process.execPath, [script, "--limit", "invalid"], { cwd: root, encoding: "utf8", stdio: "pipe" })).toThrow();
  });
});
