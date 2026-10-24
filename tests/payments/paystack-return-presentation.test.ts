import { describe, expect, it } from "vitest";
import { resolvePaystackReturnPresentation } from "@/lib/payment-presentation/paystack-return-presentation";

describe("Paystack browser return presentation", () => {
  it("changes the headline and message when the server confirms the ledger-backed payment", () => {
    expect(resolvePaystackReturnPresentation("SUCCEEDED", false)).toMatchObject({
      title: "Payment confirmed",
      description: expect.stringMatching(/verified/),
      tone: "success",
    });
  });
  it("never labels a provider-pending return as paid", () => {
    expect(resolvePaystackReturnPresentation("PROVIDER_PENDING", false)).toMatchObject({
      title: "We are checking your payment",
      tone: "information",
    });
  });
  it("never overrides a confirmed payment with an untrusted cancelled browser URL", () => {
    expect(resolvePaystackReturnPresentation("SUCCEEDED", true)).toMatchObject({ title: "Payment confirmed" });
  });
  it("handles abandoned checkout without claiming the money failed or settled", () => {
    expect(resolvePaystackReturnPresentation("PROVIDER_PENDING", true)).toMatchObject({
      title: "Checkout not completed",
      tone: "warning",
    });
  });
  it("reports a failed provider state distinctly", () => {
    expect(resolvePaystackReturnPresentation("FAILED", false)).toMatchObject({ title: "Payment not completed", tone: "warning" });
  });
});
