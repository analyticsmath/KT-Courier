import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const verifier = readFileSync(path.join(root, "scripts", "verify-database-schema.mjs"), "utf8");

describe("database schema verification script", () => {
  it("compares a database URL with the current datamodel using Prisma diff exit codes", () => {
    expect(verifier).toContain("migrate");
    expect(verifier).toContain("diff");
    expect(verifier).toContain("--from-url");
    expect(verifier).toContain("--to-schema-datamodel");
    expect(verifier).toContain("--exit-code");
  });

  it("uses shared sanitization rather than writing connection details", () => {
    expect(verifier).toContain("safeError");
    expect(verifier).toContain("safeLog");
    expect(verifier).not.toMatch(/console\.(?:log|error)/);
  });
});
