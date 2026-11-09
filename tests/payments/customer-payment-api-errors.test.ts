import { describe, expect, it } from "vitest";
import { PaymentError } from "@/lib/payments/errors";
import { paymentApiError } from "@/lib/payments/customer-api-policy";

describe("customer card checkout actionable payment errors", () => {
  it.each([
    ["PAYMENT_PROVIDER_NOT_CONFIGURED", 503],
    ["PAYMENT_PROVIDER_CONFIGURATION_INVALID", 503],
    ["PAYMENT_PROVIDER_PRODUCTION_NOT_READY", 503],
    ["PAYSTACK_NOT_CONFIGURED", 503],
    ["PAYSTACK_PRODUCTION_NOT_READY", 503],
    ["PAYMENT_PROVIDER_RESPONSE_INVALID", 503],
    ["PAYMENT_PROVIDER_TIMEOUT", 503],
    ["PAYMENT_PROVIDER_RATE_LIMITED", 429],
    ["PAYMENT_PAYER_EMAIL_REQUIRED", 422],
    ["PAYSTACK_PAYER_EMAIL_REQUIRED", 422],
  ] as const)("returns %s with HTTP %i instead of generic 422", async (code, expectedStatus) => {
    const response = paymentApiError(new PaymentError(code, "Sensitive provider diagnostic"));
    expect(response.status).toBe(expectedStatus);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const body = await response.json();
    expect(body.error).toEqual(expect.any(String));
    expect(body.error).not.toContain("Sensitive provider diagnostic");
    expect(body.error).not.toBe("Payment request is invalid.");
  });
});
