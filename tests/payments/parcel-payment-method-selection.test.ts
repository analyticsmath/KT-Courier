import { describe, expect, it } from "vitest";
import { assertParcelPaymentChoice, assertSelectedPaymentMode } from "@/lib/payments/parcel-payment-method-selection";

describe("parcel payment selection authority", () => {
  it("parses 50/50 request but only the authoritative payment policy may authorize it", () => {
    expect(() => assertParcelPaymentChoice("PARCEL_DOCUMENT", "DEPOSIT_PLUS_COD")).not.toThrow();
    expect(() => assertSelectedPaymentMode("DEPOSIT_PLUS_COD", "DIGITAL_ONLY"))
      .toThrowError(expect.objectContaining({ code: "PAYMENT_METHOD_NOT_ALLOWED" }));
    expect(() => assertSelectedPaymentMode("DEPOSIT_PLUS_COD", "DEPOSIT_PLUS_COD")).not.toThrow();
  });

  it("rejects discontinued 100% FULL_COD choices across selection helpers", () => {
    expect(() => assertParcelPaymentChoice("PARCEL_DOCUMENT", "FULL_COD"))
      .toThrowError(expect.objectContaining({ code: "PAYMENT_METHOD_NOT_ALLOWED" }));
    expect(() => assertSelectedPaymentMode("FULL_COD", "DIGITAL_ONLY"))
      .toThrowError(expect.objectContaining({ code: "PAYMENT_METHOD_NOT_ALLOWED" }));
    expect(() => assertSelectedPaymentMode("FULL_COD", "FULL_COD"))
      .toThrowError(expect.objectContaining({ code: "PAYMENT_METHOD_NOT_ALLOWED" }));
  });
});
