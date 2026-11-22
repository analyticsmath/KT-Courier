import { describe, expect, it } from "vitest";
import {
  definitiveProviderError,
  normalizeCheckoutInitiationError,
  normalizeProviderError,
} from "@/lib/payments/providers/provider-errors";
import { PaymentError } from "@/lib/payments/errors";

describe("provider error policy", () => {
  it("treats AbortError and TimeoutError as UNKNOWN/TIMEOUT rather than definitive failure", () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    expect(normalizeProviderError(abortError)).toMatchObject({ category: "TIMEOUT", code: "PROVIDER_CALL_TIMEOUT", definitive: false });

    const timeoutError = new Error("Timed out");
    timeoutError.name = "TimeoutError";
    expect(normalizeProviderError(timeoutError)).toMatchObject({ category: "TIMEOUT", code: "PROVIDER_CALL_TIMEOUT", definitive: false });
  });

  it("maps malformed responses and reference conflicts to non-definitive MALFORMED_RESPONSE", () => {
    expect(
      normalizeCheckoutInitiationError(new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "bad payload")),
    ).toMatchObject({ category: "MALFORMED_RESPONSE", code: "PAYMENT_PROVIDER_RESPONSE_INVALID", definitive: false });

    expect(
      normalizeCheckoutInitiationError(new PaymentError("PAYMENT_PROVIDER_REFERENCE_CONFLICT", "mismatched ref")),
    ).toMatchObject({ category: "MALFORMED_RESPONSE", code: "PAYMENT_PROVIDER_REFERENCE_CONFLICT", definitive: false });
  });

  it("normalizes configuration failures without raw errors", () => expect(definitiveProviderError("CONFIGURATION", "MISSING")).toMatchObject({ configurationFault: true, definitive: true }));
});

