import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import type { PaystackRuntimeConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { paymentApiError } from "@/lib/payments/customer-api-policy";

const mocks = vi.hoisted(() => ({ prisma: { $transaction: vi.fn() }, tx: {} as Record<string, unknown> }));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";

const config: PaystackRuntimeConfiguration = {
  mode: "test",
  environment: "sandbox",
  secretKey: "sk_test_SUPERSECRET_DO_NOT_LOG",
  appOrigin: "https://ktcouriers.example",
  apiBaseUrl: "https://api.paystack.co",
  credentialVersion: "test-v1",
  checkoutAuditVersion: "paystack-redirect-v1",
  configurationFingerprint: "paystack-v1:sandbox",
  eftChannelEnabled: false,
};

const callbackUrls = () => ({
  returnUrl: "https://ktcouriers.example/payments/paystack/return?payment=pay_abcdefghijklmnop",
  cancelUrl: "https://ktcouriers.example/payments/paystack/cancel?payment=pay_abcdefghijklmnop",
  notificationUrl: "https://ktcouriers.example/api/payments/paystack/webhook",
  returnRouteId: "payfast-return" as const,
  cancelRouteId: "payfast-cancel" as const,
  notificationRouteId: "payfast-itn-reserved" as const,
});

const SECRET_PII_VALUES = [
  "sk_test_SUPERSECRET_DO_NOT_LOG",
  "sk_live_SECRET123",
  "whsec_SECRET999",
  "tok_BEARER_SECRET",
  "alice.payer@example.test",
  "leaked.customer@example.com",
];

let payment: Record<string, unknown>;
let attempt: Record<string, unknown> | null;
let reconciliationCases: Array<Record<string, unknown>>;

function installTransactionMock() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    payment: {
      findUnique: vi.fn(async () => payment),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const increment = (data.version as { increment?: number } | undefined)?.increment ?? 0;
        payment = { ...payment, ...data, version: Number(payment.version) + increment };
        if (data.latestAttemptNumber !== undefined) payment.latestAttemptNumber = data.latestAttemptNumber;
        return { count: 1 };
      }),
    },
    paymentAttempt: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; idempotencyKey?: string } }) => {
        if (!attempt) return null;
        if (where.id && attempt.id !== where.id) return null;
        if (where.idempotencyKey && attempt.idempotencyKey !== where.idempotencyKey) return null;
        return attempt;
      }),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        attempt = {
          id: "attempt-1",
          ...data,
          providerReference: null,
          redirectUrl: null,
          expiresAt: null,
          providerStatusCode: null,
          checkoutActionType: null,
          checkoutPreparedAt: null,
          failureCategory: null,
          failureCode: null,
          failureMessage: null,
          requestSnapshot: null,
          resultSnapshot: null,
          startedAt: null,
          completedAt: null,
          createdAt: new Date("2026-11-22T08:00:00Z"),
          updatedAt: new Date("2026-11-22T08:00:00Z"),
        };
        return attempt;
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (!attempt) return { count: 0 };
        const increment = (data.version as { increment?: number } | undefined)?.increment ?? 0;
        attempt = {
          ...attempt,
          ...data,
          version: Number(attempt.version) + increment,
          updatedAt: new Date("2026-11-22T08:00:05Z"),
        };
        return { count: 1 };
      }),
    },
    paymentStatusHistory: { create: vi.fn(), createMany: vi.fn() },
    paymentReconciliationCase: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: "recon-1", ...data };
        reconciliationCases.push(created);
        return created;
      }),
      update: vi.fn(),
    },
  };
  mocks.tx = tx;
  mocks.prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => {
    const paymentBefore = { ...payment };
    const attemptBefore = attempt ? { ...attempt } : null;
    try {
      return await callback(tx);
    } catch (error) {
      payment = paymentBefore;
      attempt = attemptBefore;
      throw error;
    }
  });
}

function createPaystackRegistry(client = new PaystackClient({ secretKey: config.secretKey, baseUrl: config.apiBaseUrl })) {
  const adapter = new PaystackAdapter(config, client);
  return new PaymentProviderRegistry({ adapters: [adapter] });
}

function assertNoSecretsOrPii(value: unknown) {
  const serialized = JSON.stringify(value) ?? "";
  for (const sensitive of SECRET_PII_VALUES) {
    expect(serialized).not.toContain(sensitive);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  attempt = null;
  reconciliationCases = [];
  payment = {
    id: "payment-1",
    publicReference: "pay_abcdefghijklmnop",
    userId: "payer-1",
    orderId: "order-1",
    provider: null,
    status: "CREATED",
    amount: new Prisma.Decimal("179.00"),
    currency: "ZAR",
    version: 0,
    latestAttemptNumber: 0,
    failedAt: null,
    expiresAt: null,
    order: { orderNumber: "KT-2026-136446" },
    user: { email: "alice.payer@example.test", name: "Alice Payer" },
  };
  installTransactionMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Paystack initialization & verify response handling", () => {
  it("accepts a valid initialization response and sets REQUIRES_ACTION with non-terminal completedAt=null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: true,
            message: "Authorization URL created",
            data: {
              authorization_url: "https://checkout.paystack.com/valid-session-123",
              access_code: "ac_valid_123",
              reference: "kt-payment-pay=uabcdefghijklmnop-attempt-1",
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const session = await createProviderCheckoutSession(
      { id: "payer-1" },
      { paymentId: "payment-1", provider: "PAYSTACK", idempotencyKey: "init:valid:1" },
      { registry: createPaystackRegistry(), callbackUrls },
    );

    expect(session.paymentStatus).toBe("REQUIRES_ACTION");
    expect(session.attempt).toMatchObject({
      status: "REQUIRES_ACTION",
      checkoutActionType: "REDIRECT_GET",
      redirectUrl: "https://checkout.paystack.com/valid-session-123",
      merchantReference: "kt-payment-pay=uabcdefghijklmnop-attempt-1",
    });
    expect(attempt?.completedAt).toBeNull();
    expect(payment.status).toBe("REQUIRES_ACTION");
    expect(payment.succeededAt).toBeNull();
    expect(reconciliationCases).toHaveLength(0);
    assertNoSecretsOrPii({ session, attempt, payment: { ...payment, user: undefined } });
  });

  it.each([
    {
      label: "status: false on HTTP 200",
      response: () =>
        new Response(
          JSON.stringify({ status: false, message: "Duplicate Transaction Reference" }),
          { status: 200 },
        ),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "non-boolean string status: 'false' on HTTP 200",
      response: () =>
        new Response(
          JSON.stringify({
            status: "false",
            message: "ok",
            data: {
              authorization_url: "https://checkout.paystack.com/fake",
              access_code: "ac_1",
              reference: "kt-payment-pay=uabcdefghijklmnop-attempt-1",
            },
          }),
          { status: 200 },
        ),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "missing data property",
      response: () =>
        new Response(JSON.stringify({ status: true, message: "ok" }), { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "null data property",
      response: () =>
        new Response(JSON.stringify({ status: true, message: "ok", data: null }), { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "array data property",
      response: () =>
        new Response(JSON.stringify({ status: true, message: "ok", data: [] }), { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "missing authorization_url",
      response: () =>
        new Response(
          JSON.stringify({
            status: true,
            message: "ok",
            data: {
              access_code: "ac_missing_url",
              reference: "kt-payment-pay=uabcdefghijklmnop-attempt-1",
            },
          }),
          { status: 200 },
        ),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "blank authorization_url",
      response: () =>
        new Response(
          JSON.stringify({
            status: true,
            message: "ok",
            data: {
              authorization_url: "   ",
              access_code: "ac_blank",
              reference: "kt-payment-pay=uabcdefghijklmnop-attempt-1",
            },
          }),
          { status: 200 },
        ),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "untrusted authorization_url domain",
      response: () =>
        new Response(
          JSON.stringify({
            status: true,
            message: "ok",
            data: {
              authorization_url: "https://untrusted.example/checkout",
              access_code: "ac_evil",
              reference: "kt-payment-pay=uabcdefghijklmnop-attempt-1",
            },
          }),
          { status: 200 },
        ),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "empty null response body",
      response: () => new Response(null, { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "empty string response body",
      response: () => new Response("", { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "HTML non-JSON response",
      response: () =>
        new Response("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "truncated invalid JSON response",
      response: () => new Response('{"status":true,"data":', { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "HTTP 200 JSON null payload",
      response: () => new Response("null", { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "HTTP 200 JSON string payload",
      response: () => new Response('"ok"', { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "HTTP 200 JSON array payload",
      response: () => new Response("[]", { status: 200 }),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "missing data.reference",
      response: () =>
        new Response(
          JSON.stringify({
            status: true,
            message: "ok",
            data: {
              authorization_url: "https://checkout.paystack.com/valid-without-ref",
              access_code: "ac_no_ref",
            },
          }),
          { status: 200 },
        ),
      expectedCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
    },
    {
      label: "mismatched data.reference",
      response: () =>
        new Response(
          JSON.stringify({
            status: true,
            message: "ok",
            data: {
              authorization_url: "https://checkout.paystack.com/other-ref",
              access_code: "ac_mismatch",
              reference: "OTHER-MERCHANT-REF-999",
            },
          }),
          { status: 200 },
        ),
      expectedCode: "PAYMENT_PROVIDER_REFERENCE_CONFLICT",
    },
  ])(
    "preserves UNKNOWN / MALFORMED_RESPONSE without marking succeeded or reconciled for: $label",
    async ({ response, expectedCode }) => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));

      const session = await createProviderCheckoutSession(
        { id: "payer-1" },
        { paymentId: "payment-1", provider: "PAYSTACK", idempotencyKey: "init:ambiguous:1" },
        { registry: createPaystackRegistry(), callbackUrls },
      );

      expect(session.paymentStatus).toBe("PROCESSING");
      expect(session.attempt).toMatchObject({
        status: "UNKNOWN",
        failureCategory: "MALFORMED_RESPONSE",
        checkoutActionType: null,
        redirectUrl: null,
      });
      expect(attempt?.failureCode).toBe(expectedCode);
      expect(attempt?.completedAt).toBeNull();
      expect(payment.status).toBe("PROCESSING");
      expect(payment.succeededAt).toBeNull();
      expect(payment.successLedgerJournalId).toBeUndefined();
      expect(reconciliationCases).toHaveLength(0);
      assertNoSecretsOrPii({
        session,
        attempt,
        payment: { ...payment, user: undefined },
        warnCalls: warnSpy.mock.calls,
        errorCalls: errorSpy.mock.calls,
      });
    },
  );

  it("enforces missing/mismatched reference and status validation directly inside PaystackClient.initializeTransaction", async () => {
    const client = new PaystackClient({ secretKey: config.secretKey, baseUrl: config.apiBaseUrl });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: true,
            data: {
              authorization_url: "https://checkout.paystack.com/abc",
              access_code: "ac_1",
              reference: "wrong-reference",
            },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      client.initializeTransaction({
        email: "alice.payer@example.test",
        amountCents: 17900,
        reference: "expected-reference",
        callbackUrl: "https://ktcouriers.example/return",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_REFERENCE_CONFLICT" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: true,
            data: {
              authorization_url: "https://checkout.paystack.com/abc",
              access_code: "ac_1",
            },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      client.initializeTransaction({
        email: "alice.payer@example.test",
        amountCents: 17900,
        reference: "expected-reference",
        callbackUrl: "https://ktcouriers.example/return",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_RESPONSE_INVALID" });
  });

  it("rejects non-boolean status and non-object data in PaystackClient.verifyTransaction without misclassifying as not-found", async () => {
    const client = new PaystackClient({ secretKey: config.secretKey, baseUrl: config.apiBaseUrl });

    for (const payload of [
      { status: "false", data: { status: "success", reference: "ref_1" } },
      { status: true, data: null },
      { status: true, data: [] },
      null,
      [],
      "ok",
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
      await expect(client.verifyTransaction("ref_1")).rejects.toMatchObject({
        code: "PAYMENT_PROVIDER_RESPONSE_INVALID",
      });
    }
  });

  it("preserves UNKNOWN/TIMEOUT on DOM TimeoutError from fetch signal", async () => {
    const timeoutErr = new DOMException("The operation was timed out due to timeout", "TimeoutError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutErr));

    const session = await createProviderCheckoutSession(
      { id: "payer-1" },
      { paymentId: "payment-1", provider: "PAYSTACK", idempotencyKey: "init:timeout:1" },
      { registry: createPaystackRegistry(), callbackUrls },
    );

    expect(session.paymentStatus).toBe("PROCESSING");
    expect(session.attempt).toMatchObject({
      status: "UNKNOWN",
      failureCategory: "TIMEOUT",
    });
    expect(attempt?.failureCode).toBe("PROVIDER_CALL_TIMEOUT");
    expect(attempt?.completedAt).toBeNull();
  });

  it("redacts secrets, tokens, and customer emails from Paystack upstream error messages and api logs", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = new PaystackClient({ secretKey: config.secretKey, baseUrl: config.apiBaseUrl });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: false,
            message:
              "Invalid customer leaked.customer@example.com with sk_live_SECRET123 and whsec_SECRET999 Authorization Bearer tok_BEARER_SECRET",
          }),
          { status: 400 },
        ),
      ),
    );

    let thrown: unknown;
    try {
      await client.initializeTransaction({
        email: "alice.payer@example.test",
        amountCents: 17900,
        reference: "kt-ref-1",
        callbackUrl: "https://ktcouriers.example/return",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: "PAYMENT_PROVIDER_REQUEST_INVALID" });
    assertNoSecretsOrPii((thrown as Error).message);

    const apiResponse = paymentApiError(thrown);
    expect(apiResponse.status).toBe(422);
    assertNoSecretsOrPii({
      body: await apiResponse.json(),
      warnCalls: warnSpy.mock.calls,
      errorCalls: errorSpy.mock.calls,
    });
  });
});
