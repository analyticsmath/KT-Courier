import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { subscriptionScriptOptions } from "../../scripts/subscription-script-support.mjs";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const processors = [
  "create-subscription-renewal-cycles",
  "process-subscription-renewals",
  "process-subscription-dunning",
  "process-subscription-cancellations",
  "synchronize-subscription-providers",
  "expire-subscription-entitlements",
  "scan-subscription-reconciliation",
  "recognize-subscription-revenue",
] as const;

describe("subscription processor contract", () => {
  it("parses bounded dry-run/apply modes without allowing an ambiguous invocation", () => {
    expect(subscriptionScriptOptions(["--dry-run", "--limit", "7"])).toEqual({ apply: false, dryRun: true, limit: 7 });
    expect(subscriptionScriptOptions(["--apply", "--limit", "500"])).toEqual({ apply: true, dryRun: false, limit: 500 });
    expect(() => subscriptionScriptOptions(["--apply", "--dry-run"])).toThrow("Choose either");
    expect(() => subscriptionScriptOptions(["--limit", "501"])).toThrow("1 to 500");
  });

  it("keeps each shell read-only and delegates apply to the bounded canonical TypeScript processor", () => {
    const support = read("scripts/subscription-script-support.mjs");
    const canonical = read("scripts/subscription-processor.ts");
    for (const processor of processors) {
      expect(read(`scripts/${processor}.mjs`)).toContain(`runSubscriptionOperation("${processor}")`);
      expect(canonical).toContain(`case "${processor}"`);
    }
    expect(support).toContain("scripts/subscription-processor.ts");
    expect(canonical).toContain("take: limit");
    expect(canonical).toContain("subscription-processor:${processor}:${row.publicReference}:${index}");
    expect(support).not.toMatch(/ledgerAccount\.update|markPaid|subscriptionEntitlementGrant\.create|providerStatus/);
  });
});
