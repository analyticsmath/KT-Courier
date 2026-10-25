import { describe, expect, it } from "vitest";
import { assertParcelPaymentChoice, assertSelectedPaymentMode } from "@/lib/payments/parcel-payment-method-selection";

describe("parcel payment selection authority", () => {
  it("rejects the unsupported legacy 50/50 personal-parcel option as a typed client error", () => {
    expect(() => assertParcelPaymentChoice("PARCEL_DOCUMENT", "DEPOSIT_PLUS_COD"))
      .toThrowError(expect.objectContaining({ code: "PAYMENT_METHOD_NOT_ALLOWED" }));
  });
  it("accepts full cash as a requested payment choice pending server policy approval", () => {
    expect(() => assertParcelPaymentChoice("PARCEL_DOCUMENT", "FULL_COD")).not.toThrow();
  });
  it("rejects a full-COD request where the only server policy authorizes online payment", () => {
    expect(() => assertSelectedPaymentMode("FULL_COD", "DIGITAL_ONLY"))
      .toThrowError(expect.objectContaining({ code: "PAYMENT_METHOD_NOT_ALLOWED" }));
  });
  it("accepts a server-authorized full-COD match", () => {
    expect(() => assertSelectedPaymentMode("FULL_COD", "FULL_COD")).not.toThrow();
  });
});
