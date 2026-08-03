import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(join(process.cwd(), "lib/services", name), "utf8");
describe("refund service source boundaries", () => {
  const combined = ["refund-request.service.ts", "refund-wallet-completion.service.ts", "refund-provider-execution.service.ts"].map(source).join("\n");
  it("does not mutate order or payment status", () => {
    expect(combined).not.toMatch(/\border\.(?:update|updateMany|upsert|delete)/);
    expect(combined).not.toMatch(/payment\.(?:update|updateMany)[\s\S]{0,180}\bstatus\s*:/);
  });
  it("does not directly mutate legacy wallet balance fields or post refund fees", () => {
    expect(combined).not.toMatch(/availableBalance|pendingBalance|lockedBalance/);
    expect(combined).not.toMatch(/provider[_ -]?fee|refund[_ -]?fee/i);
  });
  it("calls the provider outside the database reservation transaction", () => {
    const provider = source("refund-provider-execution.service.ts");
    expect(provider.indexOf("await callRefundProvider")).toBeGreaterThan(provider.indexOf("await reserveProviderAttempt"));
    expect(provider).toMatch(/Promise\.race\(\[adapter\.createRefund/);
  });
});
