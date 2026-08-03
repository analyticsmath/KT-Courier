import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAYFAST_PROCESSING_ENDPOINTS, PAYFAST_PROVIDER_IDENTITY } from "@/lib/payments/providers/payfast/payfast-config";

describe("South African Payfast identity", () => {
  it("pins Payfast by Network identity and official processing hosts", () => {
    expect(PAYFAST_PROVIDER_IDENTITY).toBe("South African Payfast by Network");
    expect(new URL(PAYFAST_PROCESSING_ENDPOINTS.sandbox).hostname).toBe("sandbox.payfast.co.za");
    expect(new URL(PAYFAST_PROCESSING_ENDPOINTS.production).hostname).toBe("www.payfast.co.za");
  });
  it("contains no Pakistani PayFast runtime domain or identity", () => {
    const runtime = [
      "lib/payments/providers/payfast/payfast-config.ts",
      "lib/payments/providers/payfast/payfast-adapter.ts",
      "lib/payments/providers/payfast/payfast-checkout-request.ts",
    ].map((file) => readFileSync(file, "utf8")).join("\n");
    expect(runtime).not.toMatch(/gopayfast\.com|api\.gopayfast\.com|Pakistan PayFast/i);
  });
});
