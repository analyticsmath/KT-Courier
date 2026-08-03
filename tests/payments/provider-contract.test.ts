import { describe, expect, it } from "vitest";
import { PaymentProviderRegistry, createProductionPaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { FakePaymentProvider } from "./fake-payment-provider";
describe("provider contract and registry", () => {
  it("exposes capabilities and safe normalized output from direct test injection", async () => { const fake = new FakePaymentProvider("processing"); const registry = new PaymentProviderRegistry({ adapters: [fake] }); expect(registry.readiness()[0].capabilities.supportsStatusLookup).toBe(true); });
  it("does not register the fake adapter in production", () => { const registry = createProductionPaymentProviderRegistry(); expect(registry.readiness()[0]).toMatchObject({ code: "PAYFAST", configured: false, active: false }); expect(() => registry.getAdapter("PAYFAST")).toThrow(); });
});

