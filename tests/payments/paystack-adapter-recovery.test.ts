import { describe, expect, it, vi } from "vitest";
import { PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import type { PaystackRuntimeConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import type { ProviderCheckoutSessionInput, ProviderCallContext } from "@/lib/payments/providers/payment-provider-adapter";

const config: PaystackRuntimeConfiguration = {
  mode: "test", environment: "sandbox",
  secretKey: "sk_test_not_a_real_key", appOrigin: "https://ktcouriers.example",
  apiBaseUrl: "https://api.paystack.co", credentialVersion: "test-v1",
  checkoutAuditVersion: "paystack-redirect-v1", configurationFingerprint: "paystack-v1:sandbox",
};
const request: ProviderCheckoutSessionInput = {
  merchantReference: "kt_test_order_123", paymentPublicReference: "pay_123",
  amount: "45.67", currency: "ZAR", customerReference: "usr_12",
  customerEmail: "buyer@example.test", orderReference: "order_123",
  returnUrl: "https://ktcouriers.example/payments/return",
  cancelUrl: "https://ktcouriers.example/payments/cancel",
  notificationUrl: "https://ktcouriers.example/api/payments/paystack/webhook",
  description: "Disposable contract test", providerOperationKey: "unique-operation",
};
const context: ProviderCallContext = {
  signal: new AbortController().signal, correlationId: "test-correlation", timeoutMs: 5000,
};
const verified = {
  id: 123, domain: "test", status: "success", reference: request.merchantReference,
  amount: 4567, currency: "ZAR", channel: "card", gateway_response: "Approved",
};
function setup() {
  const verifyTransaction = vi.fn();
  const initializeTransaction = vi.fn();
  const client = { verifyTransaction, initializeTransaction } as unknown as PaystackClient;
  return { adapter: new PaystackAdapter(config, client), verifyTransaction, initializeTransaction };
}

describe("Paystack verified checkout recovery is exact-source", () => {
  it("accepts only the exact paid reference and amount with no second provider initialize", async () => {
    const { adapter, verifyTransaction, initializeTransaction } = setup();
    verifyTransaction.mockResolvedValue(verified);
    const result = await adapter.createCheckoutSession(request, context);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.providerReference).toBe(request.merchantReference);
    expect(initializeTransaction).not.toHaveBeenCalled();
  });
  it.each([
    { reference: "another-user-payment" },
    { amount: 100 },
    { currency: "USD" },
    { domain: "live" },
  ])("rejects successful provider receipt with mismatched commercial facts: %o", async mismatch => {
    const { adapter, verifyTransaction, initializeTransaction } = setup();
    verifyTransaction.mockResolvedValue({ ...verified, ...mismatch });
    await expect(adapter.createCheckoutSession(request, context)).rejects.toThrow(/Paystack recovered/);
    expect(initializeTransaction).not.toHaveBeenCalled();
  });
  it("rejects a provider initialization result with a different reference", async () => {
    const { adapter, verifyTransaction, initializeTransaction } = setup();
    verifyTransaction.mockRejectedValue(new Error("Not found yet"));
    initializeTransaction.mockResolvedValue({
      reference: "unrelated-reference",
      authorization_url: "https://checkout.paystack.com/abc",
      access_code: "access-token",
    });
    await expect(adapter.createCheckoutSession(request, context)).rejects.toThrow(/different transaction reference/);
  });
  it("initializes one canonical merchant reference when nothing is recovered", async () => {
    const { adapter, verifyTransaction, initializeTransaction } = setup();
    verifyTransaction.mockRejectedValue(new Error("Not found yet"));
    initializeTransaction.mockResolvedValue({
      reference: request.merchantReference,
      authorization_url: "https://checkout.paystack.com/abc",
      access_code: "access-token",
    });
    const result = await adapter.createCheckoutSession(request, context);
    expect(result.status).toBe("REQUIRES_ACTION");
    expect(result.customerAction?.type).toBe("REDIRECT_GET");
    expect(initializeTransaction).toHaveBeenCalledWith(expect.objectContaining({
      reference: request.merchantReference, amountCents: 4567,
    }), context.signal);
  });
  it("refuses mismatched reference from a subsequent provider status poll", async () => {
    const { adapter, verifyTransaction } = setup();
    verifyTransaction.mockResolvedValue({ ...verified, reference: "different-payment" });
    await expect(adapter.getPaymentStatus({ merchantReference: request.merchantReference }, context)).rejects.toThrow(/different transaction reference/);
  });
});
