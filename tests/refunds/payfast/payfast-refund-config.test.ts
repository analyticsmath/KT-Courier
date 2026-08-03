import { describe, expect, it } from "vitest";
import { PAYFAST_REFUND_API_ORIGIN, resolvePayfastRefundConfiguration } from "@/lib/refunds/providers/payfast/payfast-refund-config";

describe("Payfast refund configuration", () => {
  it("pins the production API origin and never activates networking", () => {
    const resolution = resolvePayfastRefundConfiguration({ PAYFAST_MERCHANT_ID: "10000100", PAYFAST_PASSPHRASE: "secret", PAYFAST_CREDENTIAL_VERSION: "2026-01" });
    expect(PAYFAST_REFUND_API_ORIGIN).toBe("https://api.payfast.co.za");
    expect(resolution.state).toEqual({ known: true, configured: true, networkActive: false, blockReason: "PAYFAST_REFUNDS_REQUIRE_PRODUCTION_VALIDATION" });
    expect(resolution.runtime?.apiOrigin).toBe(PAYFAST_REFUND_API_ORIGIN);
  });
  it("fails configuration closed for missing or malformed credentials", () => {
    expect(resolvePayfastRefundConfiguration({}).runtime).toBeNull();
    expect(resolvePayfastRefundConfiguration({ PAYFAST_MERCHANT_ID: " id ", PAYFAST_PASSPHRASE: "x", PAYFAST_CREDENTIAL_VERSION: "v" }).state.configured).toBe(false);
  });
});
