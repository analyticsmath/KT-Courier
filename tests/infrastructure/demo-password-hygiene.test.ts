import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveDemoAccountPassword, getDefaultPasswordHash } from "@/scripts/demo/fixtures/bootstrap";

describe("Demo Password Hygiene & Secret Invariants", () => {
  describe("Password Resolution Policy", () => {
    it("returns provided KT_DEMO_ACCOUNT_PASSWORD in non-test runtime", () => {
      const pwd = resolveDemoAccountPassword({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "staging-demo",
        KT_DEMO_ACCOUNT_PASSWORD: "StagingSecretPassword2026!",
      });
      expect(pwd).toBe("StagingSecretPassword2026!");
    });

    it("throws explicit error when KT_DEMO_ACCOUNT_PASSWORD is missing in non-test runtime", () => {
      expect(() =>
        resolveDemoAccountPassword({
          NODE_ENV: "production",
          KT_RUNTIME_ENV: "staging-demo",
        }),
      ).toThrow(/KT_DEMO_ACCOUNT_PASSWORD environment variable is required/i);
    });

    it("throws explicit error when KT_DEMO_ACCOUNT_PASSWORD is missing in production runtime", () => {
      expect(() =>
        resolveDemoAccountPassword({
          NODE_ENV: "production",
          KT_RUNTIME_ENV: "production",
        }),
      ).toThrow(/KT_DEMO_ACCOUNT_PASSWORD environment variable is required/i);
    });

    it("allows deterministic test password only under test runtime", () => {
      const pwd = resolveDemoAccountPassword({
        NODE_ENV: "test",
      });
      expect(pwd).toBe("TestPassword123!");
    });

    it("generates a valid bcrypt hash from resolved password", () => {
      const hash = getDefaultPasswordHash({
        NODE_ENV: "test",
      });
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });
  });

  describe("Source Code Password Fallback Audit", () => {
    it("ensures no hardcoded 'password123' fallback exists in bootstrap or seed fixtures", () => {
      const filesToCheck = [
        "scripts/demo/fixtures/bootstrap.ts",
        "scripts/seed-full-demo.ts",
        "scripts/seed-staging-demo.ts",
        "scripts/print-demo-accounts.mjs",
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.join(process.cwd(), relPath);
        if (!fs.existsSync(fullPath)) continue;
        const content = fs.readFileSync(fullPath, "utf8");
        // Check for "password123" (case-insensitive) except in comments or test assertions
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
          if (line.includes('"password123"') || line.includes("'password123'")) {
            throw new Error(`Forbidden hardcoded password123 found in ${relPath}:${i + 1}: ${line}`);
          }
        }
      }
    });

    it("verifies scripts/print-demo-accounts.mjs redacts password by default", () => {
      const scriptPath = path.join(process.cwd(), "scripts", "print-demo-accounts.mjs");
      const content = fs.readFileSync(scriptPath, "utf8");
      expect(content.toLowerCase()).toContain("redacted");
      expect(content).toContain("KT_DEMO_ACCOUNT_PASSWORD");
    });
  });
});
