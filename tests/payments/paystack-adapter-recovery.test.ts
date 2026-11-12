import { afterEach, describe, expect, it, vi } from "vitest";
import { PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import { PaymentError } from "@/lib/payments/errors";
import type { PaystackRuntimeConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import type { ProviderCheckoutSessionInput, ProviderCallContext } from "@/lib/payments/providers/payment-provider-adapter";

afterEach(() => vi.unstubAllGlobals());

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

describe("Paystack missing-reference classification", () => {
  const client = new PaystackClient({ secretKey: "sk_test_disposable", baseUrl: "https://api.paystack.co" });
  it("rejects an oversized verify response without treating it as a missing reference", async () => {
    const body = JSON.stringify({ status: false, message: "Transaction reference not found", padding: "x".repeat(1_048_577) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 404 })));
    await expect(client.verifyTransaction("merchant_ref_1")).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_RESPONSE_INVALID" });
  });
  it("bounds Paystack verification calls even when the caller supplies no abort signal", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: true, data: {
        ...verified, id: 123, created_at: "2026-11-12T10:00:00Z",
      } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const result = await client.verifyTransaction("merchant_ref_1");
    expect(result.status).toBe("success");
    const [, options] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.method).toBe("GET");
  });
  it.each([200, 404])(
    "accepts only an explicit not-found verify response on HTTP %s",
    async status => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: false, message: "Transaction reference not found" }), { status })));
      await expect(client.verifyTransaction("merchant_ref_1")).rejects.toMatchObject({
        code: "PAYSTACK_TRANSACTION_NOT_FOUND",
      });
    },
  );
  it.each([
    { status: 200, message: "Invalid Merchant Selected" },
    { status: 400, message: "Transaction reference not found" },
    { status: 503, message: "Transaction reference not found" },
    { status: 404, message: "Transaction not found yet; retry" },
  ])("never treats provider failure as proven missing transaction: %o", async entry => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: false, message: entry.message }), { status: entry.status })));
    await expect(client.verifyTransaction("merchant_ref_1")).rejects.not.toMatchObject({
      code: "PAYSTACK_TRANSACTION_NOT_FOUND",
    });
  });
});

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
    verifyTransaction.mockRejectedValue(new PaymentError("PAYSTACK_TRANSACTION_NOT_FOUND", "Paystack has no transaction for this reference."));
    initializeTransaction.mockResolvedValue({
      reference: "unrelated-reference",
      authorization_url: "https://checkout.paystack.com/abc",
      access_code: "access-token",
    });
    await expect(adapter.createCheckoutSession(request, context)).rejects.toThrow(/different transaction reference/);
  });
  it("initializes one canonical merchant reference when nothing is recovered", async () => {
    const { adapter, verifyTransaction, initializeTransaction } = setup();
    verifyTransaction.mockRejectedValue(new PaymentError("PAYSTACK_TRANSACTION_NOT_FOUND", "Paystack has no transaction for this reference."));
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
  it.each([
    new PaymentError("PAYMENT_PROVIDER_UNAVAILABLE", "Paystack unavailable", true),
    new PaymentError("PAYMENT_PROVIDER_AUTHENTICATION_FAILED", "Invalid provider key"),
    new PaymentError("PAYMENT_PROVIDER_REQUEST_INVALID", "Malformed reference"),
    new Error("Unexpected verification failure"),
  ])("does not initialize after ambiguous verification error: %s", async cause => {
    const { adapter, verifyTransaction, initializeTransaction } = setup();
    verifyTransaction.mockRejectedValue(cause);
    await expect(adapter.createCheckoutSession(request, context)).rejects.toBe(cause);
    expect(initializeTransaction).not.toHaveBeenCalled();
  });

  it.each(["pending", "ongoing", "failed", "abandoned", "reversed", "processing"])(
    "does not initialize a second charge against an already existing %s reference",
    async status => {
      const { adapter, verifyTransaction, initializeTransaction } = setup();
      verifyTransaction.mockResolvedValue({ ...verified, status });
      await expect(adapter.createCheckoutSession(request, context)).rejects.toMatchObject({
        code: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN",
      });
      expect(initializeTransaction).not.toHaveBeenCalled();
    },
  );

  it("rejects an existing pending reference even if its amount, currency or environment differs", async () => {
    const { adapter, verifyTransaction, initializeTransaction } = setup();
    verifyTransaction.mockResolvedValue({ ...verified, status: "pending", amount: 1 });
    await expect(adapter.createCheckoutSession(request, context)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    });
    expect(initializeTransaction).not.toHaveBeenCalled();
  });

  it("refuses mismatched reference from a subsequent provider status poll", async () => {
    const { adapter, verifyTransaction } = setup();
    verifyTransaction.mockResolvedValue({ ...verified, reference: "different-payment" });
    await expect(adapter.getPaymentStatus({ merchantReference: request.merchantReference }, context)).rejects.toThrow(/different transaction reference/);
  });
});
