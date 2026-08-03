import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeFiles = [
  "lib/services/payment-preparation.service.ts", "lib/services/payment-provider-session.service.ts", "lib/services/payfast-checkout.service.ts",
  "app/(payments)/payments/payfast/return/page.tsx", "app/(payments)/payments/payfast/cancel/page.tsx",
].map((file) => readFileSync(file, "utf8")).join("\n");

describe("Payfast Phase 11 source boundaries", () => {
  it("does not infer success/cancellation from checkout or browser navigation", () => expect(runtimeFiles).not.toMatch(/status:\s*["']SUCCEEDED["']|status:\s*["']CANCELLED["']/));
  it("does not post ledger, wallet, order, pricing, dispatch, or driver mutations", () => expect(runtimeFiles).not.toMatch(/(?:ledgerJournal|ledgerEntry|walletTransaction|order|pricingQuote|orderAssignment|driverProfile)\.(?:create|update|updateMany|delete|upsert)/));
  it("contains no public payment security configuration", () => expect(runtimeFiles).not.toMatch(/NEXT_PUBLIC_(?:PAYFAST|PAYMENT)/));
});
