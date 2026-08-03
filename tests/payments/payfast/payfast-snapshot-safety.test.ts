import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeProviderSnapshot } from "@/lib/payments/provider-snapshot-policy";

describe("Payfast snapshot safety", () => {
  it("redacts forbidden material by key", () => expect(sanitizeProviderSnapshot({ signature: "x", merchant_key: "y", passphrase: "z", amount: "1.00" })).toEqual({ amount: "1.00", merchant_key: "[REDACTED]", passphrase: "[REDACTED]", signature: "[REDACTED]" }));
  it("never persists signed fields from the session service", () => {
    const source = readFileSync("lib/services/payment-provider-session.service.ts", "utf8");
    expect(source).not.toMatch(/requestSnapshot[\s\S]{0,500}(?:customerEmail|merchantKey|passphrase|signature|customerAction\.fields)/);
  });
});
