import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeProviderSnapshot } from "@/lib/payments/provider-snapshot-policy";

describe("Payfast snapshot safety", () => {
  it("redacts forbidden material by key", () => expect(sanitizeProviderSnapshot({ signature: "x", merchant_key: "y", passphrase: "z", amount: "1.00" })).toEqual({ amount: "1.00", merchant_key: "[REDACTED]", passphrase: "[REDACTED]", signature: "[REDACTED]" }));
  it("never persists signed fields from the session service", () => {
    const source = readFileSync("lib/services/payment-provider-session.service.ts", "utf8");
    expect(source).not.toMatch(/requestSnapshot[\s\S]{0,500}(?:customerEmail|merchantKey|passphrase|signature|customerAction\.fields)/);
  });

  it("verifies the PayFast invariant regex permits safe metadata while rejecting forbidden secrets and raw forms", () => {
    const pattern = /("(merchant[_-]?key|passphrase|signature|email_address)"\s*:|merchant_id.*merchant_key.*return_url)/i;

    // Safe metadata with signatureVersion passes
    const safePayload = JSON.stringify({
      status: "REQUIRES_ACTION",
      providerStatusCode: "CHECKOUT_FORM_READY",
      metadata: {
        environment: "sandbox",
        signatureVersion: "payfast-md5-v1",
        requestFieldVersion: "payfast-custom-checkout-v1",
        configurationFingerprint: "payfast-v1:sandbox",
      },
    });
    expect(pattern.test(safePayload)).toBe(false);

    // Leaked signature fails
    expect(pattern.test(JSON.stringify({ signature: "d41d8cd98f00b204e9800998ecf8427e" }))).toBe(true);

    // Leaked merchant_key fails
    expect(pattern.test(JSON.stringify({ merchant_key: "secret-key-value" }))).toBe(true);

    // Leaked passphrase fails
    expect(pattern.test(JSON.stringify({ passphrase: "super-secret-salt" }))).toBe(true);

    // Leaked email_address fails
    expect(pattern.test(JSON.stringify({ email_address: "user@example.invalid" }))).toBe(true);

    // Raw form persistence fails
    expect(pattern.test("merchant_id=10000100&merchant_key=46f0cd694581a&return_url=https://example.com/return")).toBe(true);
  });
});
