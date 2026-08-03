import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArguments } from "../../scripts/promoter-processor.mjs";

const root = process.cwd();
const names = ["phase25-promoter-preflight.mjs", "expire-promoter-attributions.mjs", "process-promoter-qualifications.mjs", "release-promoter-earnings.mjs", "process-promoter-reversals.mjs", "scan-promoter-fraud.mjs", "scan-promoter-reconciliation.mjs", "verify-promoter-invariants.mjs", "promoter-integration-test.mjs"];
const source = names.map((name) => readFileSync(join(root, "scripts", name), "utf8"));

describe("Phase 25 bounded processors", () => {
  it("defaults to dry-run and supports apply", () => {
    expect(parseArguments([])).toEqual({ apply: false, limit: 100 });
    expect(parseArguments(["--dry-run", "--limit=7"])).toEqual({ apply: false, limit: 7 });
    expect(parseArguments(["--apply", "--limit=7"])).toEqual({ apply: true, limit: 7 });
  });
  it("rejects invalid limits and conflicting/unknown flags", () => {
    for (const args of [["--limit=0"], ["--limit=501"], ["--limit=1.5"], ["--dry-run", "--apply"], ["--unknown"]]) expect(() => parseArguments(args)).toThrow();
  });
  it("has all nine executable bounded processor scripts", () => expect(source.every((content) => content.includes("runPromoterProcessor") && content.includes("take: limit"))).toBe(true));
  it("constructs production composition and invokes canonical services", () => {
    expect(readFileSync(join(root, "scripts/promoter-processor.mjs"), "utf8")).toMatch(/resolvePromoterProductionComposition/);
    expect(source.every((content) => content.includes("root.services."))).toBe(true);
    expect(source.every((content) => content.includes("operationId"))).toBe(true);
  });
  it("contains no fabricated candidates or direct financial mutation", () => {
    const combined = source.join("\n");
    expect(combined).not.toMatch(/selectCandidates:\s*async\s*\([^)]*\)\s*=>\s*\[\]/);
    expect(combined).not.toMatch(/wallet\.(update|create)|ledger\.(post|update)|balance\s*=/i);
    expect(combined).not.toMatch(/forceResolve|manualAdjustment|genericResolve/);
  });
});
