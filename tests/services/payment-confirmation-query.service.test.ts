import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync("lib/services/payment-confirmation-query.service.ts", "utf8");
describe("payment confirmation admin query service", () => {
  it("maps safe list/detail evidence and excludes receipt fingerprints and source values", () => { expect(source).toContain("verification:"); expect(source).toContain("reconciliationCases"); expect(source).not.toMatch(/eventFingerprint\s*:/); expect(source).not.toMatch(/sourceAddress\s*:/); });
  it("contains no mutation operation", () => expect(source).not.toMatch(/\.(?:create|update|delete|upsert)\s*\(/));
});
