import { describe, expect, it } from "vitest";
import { PaymentProviderRegistry, createProductionPaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { FakePaymentProvider } from "../payments/fake-payment-provider";
describe("payment provider registry", () => {
  it("is an explicit allowlist with safe readiness only", () => expect(createProductionPaymentProviderRegistry().readiness()).toEqual([expect.objectContaining({ code: "PAYFAST", configured: false, active: false, environment: "not-configured" })]));
  it("supports direct deterministic test injection without a public flag", () => expect(new PaymentProviderRegistry({ adapters: [new FakePaymentProvider("processing")] }).getAdapter("PAYFAST")).toBeInstanceOf(FakePaymentProvider));
});

