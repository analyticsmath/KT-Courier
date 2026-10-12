import { describe, expect, it, vi } from "vitest";
import { assertDisposablePaystackAcceptance, assertDisposablePaystackEmail } from "@/lib/testing/disposable-paystack-policy";
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";

const safe = { KT_E2E_PAYSTACK_ACCEPTANCE: "true", KT_RUNTIME_ENV: "e2e", NODE_ENV: "test", KT_NETWORK_DISABLED: "true", KT_E2E_NETWORK_INTERNAL: "true", KT_LOCAL_FULL_FLOW: "false", PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "sk_test_disposable_browser_no_provider", DATABASE_URL: "postgresql://kt_phase75_e2e:synthetic@localhost:5432/kt_phase75_e2e", PAYMENT_APP_ORIGIN: "http://localhost:3200" };
describe("offline provider admits only the explicit disposable identity", () => {
  it("accepts its complete named local identity", () => expect(() => assertDisposablePaystackAcceptance(safe)).not.toThrow());
  for (const [key, value] of Object.entries({ KT_E2E_PAYSTACK_ACCEPTANCE: "false", KT_RUNTIME_ENV: "production", NODE_ENV: "production", KT_NETWORK_DISABLED: "false", KT_E2E_NETWORK_INTERNAL: "false", KT_LOCAL_FULL_FLOW: "true", PAYSTACK_MODE: "live", PAYSTACK_SECRET_KEY: "sk_test_another_key", DATABASE_URL: "postgresql://synthetic:synthetic@remote.invalid/kt_phase75_e2e", PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com" })) {
    it(`rejects changed ${key}`, () => expect(() => assertDisposablePaystackAcceptance({ ...safe, [key]: value })).toThrow());
  }
  it("rejects a different local database", () => expect(() => assertDisposablePaystackAcceptance({ ...safe, DATABASE_URL: "postgresql://synthetic:synthetic@localhost/kt_launch_test" })).toThrow());
  it("requires namespace-owned contacts", () => {
    expect(() => assertDisposablePaystackEmail("e2e-paystack-1440@ktcouriers.local")).not.toThrow();
    expect(() => assertDisposablePaystackEmail("customer@ktcouriers.local")).toThrow();
    expect(() => assertDisposablePaystackEmail("e2e-paystack-1440@example.com")).toThrow();
  });
  it("blocks every unsupported provider operation before network or database writes", async () => {
    for (const [key, value] of Object.entries(safe)) vi.stubEnv(key, value);
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden in policy test"));
    const client = new PaystackClient({ secretKey: safe.PAYSTACK_SECRET_KEY });
    await expect(client.createRefund({ transaction: "synthetic", amountCents: 100 })).rejects.toThrow("Operation excluded");
    await expect(client.listBanks()).rejects.toThrow("Operation excluded");
    await expect(client.getDispute("synthetic")).rejects.toThrow("Operation excluded");
    expect(fetch).not.toHaveBeenCalled();
  });
});
