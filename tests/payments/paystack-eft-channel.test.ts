import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentError } from "@/lib/payments/errors";
import { PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import {
  evaluatePaystackEftReadiness,
  isPaystackEftChannelApproved,
  resolvePaystackConfiguration,
  type PaystackRuntimeConfiguration,
} from "@/lib/payments/providers/paystack/paystack-config";
import { paymentApiError } from "@/lib/payments/customer-api-policy";
import {
  CreateProviderSessionSchema,
  PaymentChannelSchema,
  PaymentOperationSchema,
} from "@/lib/validation/payments";
import type {
  ProviderCallContext,
  ProviderCheckoutSessionInput,
} from "@/lib/payments/providers/payment-provider-adapter";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function buildConfig(eftChannelEnabled: boolean): PaystackRuntimeConfiguration {
  return {
    mode: "test",
    environment: "sandbox",
    secretKey: "sk_test_not_a_real_key",
    appOrigin: "https://ktcouriers.example",
    apiBaseUrl: "https://api.paystack.co",
    credentialVersion: "test-v1",
    checkoutAuditVersion: "paystack-redirect-v1",
    configurationFingerprint: "paystack-v1:sandbox",
    eftChannelEnabled,
  };
}

function baseSessionInput(
  paymentChannel?: "CARD" | "EFT",
): ProviderCheckoutSessionInput {
  return {
    merchantReference: "kt:payment:pay_eft_test:attempt:1",
    paymentPublicReference: "pay_eft_test_123456",
    amount: "129.00",
    currency: "ZAR",
    customerReference: "payer_123",
    customerEmail: "customer@example.test",
    orderReference: "KT-TEST-EFT-1",
    returnUrl: "https://ktcouriers.example/payments/paystack/return",
    cancelUrl: "https://ktcouriers.example/payments/paystack/cancel",
    notificationUrl: "https://ktcouriers.example/api/payments/paystack/webhook",
    description: "KT Couriers parcel delivery",
    providerOperationKey: "op_eft_test_1",
    ...(paymentChannel ? { paymentChannel } : {}),
  };
}

const callContext: ProviderCallContext = {
  signal: new AbortController().signal,
  correlationId: "corr_eft_1",
  timeoutMs: 5000,
  freshAttempt: true,
};

describe("F05: Paystack EFT channel gating and request construction", () => {
  it("fails closed on EFT when eftChannelEnabled is false without invoking Paystack HTTP", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new PaystackAdapter(buildConfig(false));

    await expect(
      adapter.createCheckoutSession(baseSessionInput("EFT"), callContext),
    ).rejects.toMatchObject({ code: "EFT_UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends channels=['card'] for CARD and channels=['eft'] for enabled EFT", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://checkout.paystack.com/test_eft_checkout",
            access_code: "acc_test_123",
            reference: parsed.reference,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const cardAdapter = new PaystackAdapter(buildConfig(false));
    const cardResult = await cardAdapter.createCheckoutSession(baseSessionInput("CARD"), callContext);
    expect(cardResult.status).toBe("REQUIRES_ACTION");
    const cardBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(cardBody.channels).toEqual(["card"]);
    expect(cardResult.safeMetadata?.paymentChannel).toBe("CARD");

    const eftAdapter = new PaystackAdapter(buildConfig(true));
    const eftResult = await eftAdapter.createCheckoutSession(baseSessionInput("EFT"), callContext);
    expect(eftResult.status).toBe("REQUIRES_ACTION");
    const eftBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(eftBody.channels).toEqual(["eft"]);
    expect(eftResult.safeMetadata?.paymentChannel).toBe("EFT");
  });

  it("evaluates PAYSTACK_EFT_CHANNEL_ENABLED strictly and maps EFT_UNAVAILABLE to HTTP 503", async () => {
    const envDisabled = {
      NODE_ENV: "test",
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_mock_key_value_123456",
      PAYMENT_APP_ORIGIN: "https://ktcouriers.example",
    };
    expect(isPaystackEftChannelApproved(envDisabled)).toBe(false);
    expect(resolvePaystackConfiguration(envDisabled).runtime?.eftChannelEnabled).toBe(false);
    expect(evaluatePaystackEftReadiness(envDisabled)).toMatchObject({
      ready: false,
      reasonCode: "PROVIDER_CHANNEL_NOT_ENABLED",
      channelRequested: "eft",
    });

    const envEnabled = { ...envDisabled, PAYSTACK_EFT_CHANNEL_ENABLED: "true" };
    expect(isPaystackEftChannelApproved(envEnabled)).toBe(true);
    expect(resolvePaystackConfiguration(envEnabled).runtime?.eftChannelEnabled).toBe(true);
    expect(evaluatePaystackEftReadiness(envEnabled)).toMatchObject({
      ready: true,
      reasonCode: "READY",
      channelRequested: "eft",
    });

    const apiResponse = paymentApiError(
      new PaymentError("EFT_UNAVAILABLE", "Paystack EFT channel is not enabled."),
    );
    expect(apiResponse.status).toBe(503);
    expect(await apiResponse.json()).toMatchObject({ code: "EFT_UNAVAILABLE" });
  });

  it("validates CARD and EFT channel inputs strictly in payment Zod schemas", () => {
    expect(PaymentChannelSchema.parse("CARD")).toBe("CARD");
    expect(PaymentChannelSchema.parse("EFT")).toBe("EFT");
    expect(PaymentChannelSchema.safeParse("CRYPTO").success).toBe(false);

    expect(
      CreateProviderSessionSchema.safeParse({
        paymentId: "pay_123",
        provider: "PAYSTACK",
        idempotencyKey: "idem_key_1234",
        channel: "EFT",
      }).success,
    ).toBe(true);
    expect(
      PaymentOperationSchema.safeParse({
        operationId: "11111111-1111-4111-8111-111111111111",
        channel: "EFT",
      }).success,
    ).toBe(true);
    expect(
      PaymentOperationSchema.safeParse({
        operationId: "11111111-1111-4111-8111-111111111111",
        channel: "BITCOIN",
      }).success,
    ).toBe(false);
  });
});
