import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkIpRateLimit: vi.fn(),
  processSandboxAcceptanceWebhook: vi.fn(),
  resolveSandboxAcceptanceConfiguration: vi.fn(),
  resolveQaAcceptanceLaneConfig: vi.fn(),
  resolveQaPaystackWebhookSecrets: vi.fn(),
  createQaPaystackClient: vi.fn(),
  processPaystackWebhook: vi.fn(),
  paymentAttemptFindUnique: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return {
    ...actual,
    checkIpRateLimit: mocks.checkIpRateLimit,
  };
});

vi.mock("@/lib/payments/sandbox-acceptance.service", () => ({
  processSandboxAcceptanceWebhook: mocks.processSandboxAcceptanceWebhook,
  resolveSandboxAcceptanceConfiguration: mocks.resolveSandboxAcceptanceConfiguration,
}));

vi.mock("@/lib/qa-acceptance/config", () => ({
  resolveQaAcceptanceLaneConfig: mocks.resolveQaAcceptanceLaneConfig,
  resolveQaPaystackWebhookSecrets: mocks.resolveQaPaystackWebhookSecrets,
  createQaPaystackClient: mocks.createQaPaystackClient,
}));

vi.mock("@/lib/services/paystack-webhook-application.service", () => ({
  processPaystackWebhook: mocks.processPaystackWebhook,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    paymentAttempt: {
      findUnique: mocks.paymentAttemptFindUnique,
    },
  },
}));

import { POST } from "@/app/api/payments/paystack/sandbox-webhook/route";

const R10_SECRET = "sk_test_r10_sandbox_secret_123456";
const QA_API_SECRET = "sk_test_qa_sandbox_secret_abcdef";
const QA_WHSEC = "whsec_qa_sandbox_signing_secret_abcdef";

function signLegacy(body: string, key: string): string {
  return createHmac("sha512", key).update(body).digest("hex");
}

function signModernV1(body: string, whsec: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const digest = createHmac("sha512", whsec).update(`${nowSec}.${body}`).digest("hex");
  return `t=${nowSec},v1=whk_test1:${digest}`;
}

function makeRequest(
  body: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("https://www.ktcouriers.com/api/payments/paystack/sandbox-webhook", {
    method: "POST",
    body,
    headers,
  });
}

describe("POST /api/payments/paystack/sandbox-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkIpRateLimit.mockResolvedValue({ ok: true, remaining: 119, retryAfterSeconds: 60 });
    mocks.resolveSandboxAcceptanceConfiguration.mockReturnValue({
      eligible: false,
      secretKey: null,
      webhookSecrets: [],
    });
    mocks.resolveQaAcceptanceLaneConfig.mockReturnValue({
      eligible: true,
    });
    mocks.resolveQaPaystackWebhookSecrets.mockReturnValue([QA_WHSEC, QA_API_SECRET]);
    mocks.createQaPaystackClient.mockReturnValue({ qaClient: true });
    mocks.paymentAttemptFindUnique.mockResolvedValue(null);
  });

  it("returns 429 with Retry-After when RATE_LIMITS.PAYMENT_WEBHOOK is exceeded", async () => {
    mocks.checkIpRateLimit.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      retryAfterSeconds: 45,
    });
    const res = await POST(makeRequest("{}", { "x-paystack-signature": "abc" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
  });

  it("returns 503 with Retry-After when distributed rate limiter fails closed", async () => {
    mocks.checkIpRateLimit.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      retryAfterSeconds: 30,
      failClosed: true,
    });
    const res = await POST(makeRequest("{}", { "x-paystack-signature": "abc" }));
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("rejects missing signatures with 401 and empty payloads with 400", async () => {
    const emptyRes = await POST(makeRequest(""));
    expect(emptyRes.status).toBe(400);

    const noSigRes = await POST(makeRequest(JSON.stringify({ event: "charge.success", data: {} })));
    expect(noSigRes.status).toBe(401);
  });

  it("returns 503 when neither R10 sandbox nor Issue #40 QA lane is active", async () => {
    mocks.resolveQaAcceptanceLaneConfig.mockReturnValue({ eligible: false });
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "ref-1" } });
    const res = await POST(makeRequest(payload, { "x-paystack-signature": signLegacy(payload, QA_API_SECRET) }));
    expect(res.status).toBe(503);
  });

  it("returns 401 for invalid legacy or modern signatures and 400 for malformed signed payloads", async () => {
    const validBody = JSON.stringify({ event: "charge.success", data: { reference: "qa_ref_1" } });
    const badSigRes = await POST(
      makeRequest(validBody, { "x-paystack-signature": "0".repeat(128) }),
    );
    expect(badSigRes.status).toBe(401);

    const badJson = "{not-valid-json";
    const badJsonRes = await POST(
      makeRequest(badJson, { "x-paystack-signature": signLegacy(badJson, QA_API_SECRET) }),
    );
    expect(badJsonRes.status).toBe(400);
  });

  it("preserves R10 pay_sbox_* settlement provenance routing", async () => {
    mocks.resolveSandboxAcceptanceConfiguration.mockReturnValue({
      eligible: true,
      secretKey: R10_SECRET,
      webhookSecrets: [],
    });
    mocks.processSandboxAcceptanceWebhook.mockResolvedValue({
      accepted: true,
      status: "SETTLED",
      reference: "pay_sbox_abcdef1234567890abcdef12",
    });

    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "pay_sbox_abcdef1234567890abcdef12", amount: 1000 },
    });
    const res = await POST(
      makeRequest(body, { "x-paystack-signature": signLegacy(body, R10_SECRET) }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      received: true,
      status: "SETTLED",
      reference: "pay_sbox_abcdef1234567890abcdef12",
    });
    expect(mocks.processSandboxAcceptanceWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.processPaystackWebhook).not.toHaveBeenCalled();
  });

  it("routes Issue #40 QA sandbox webhooks signed with modern whsec_ v1 signature to SANDBOX processing with sk_test_ API key", async () => {
    mocks.paymentAttemptFindUnique.mockResolvedValueOnce({
      providerEnvironment: "SANDBOX",
      payment: { isQaAcceptance: true },
    });
    mocks.processPaystackWebhook.mockResolvedValueOnce({
      outcome: "APPLIED",
      eventPublicReference: "pwh_qa_001",
      ledgerJournalReference: "ldj_qa_001",
    });

    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "qa_attempt_ref_001", amount: 12500, status: "success", id: 554433 },
    });
    const res = await POST(
      makeRequest(body, { "paystack-signature": signModernV1(body, QA_WHSEC) }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      received: true,
      status: "APPLIED",
      eventPublicReference: "pwh_qa_001",
      reference: "qa_attempt_ref_001",
    });
    expect(mocks.processPaystackWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "SANDBOX",
        secretKey: QA_API_SECRET,
        modernWebhookSecrets: [QA_WHSEC],
      }),
    );
  });

  it("never settles live or non-QA attempts through sandbox-webhook", async () => {
    mocks.paymentAttemptFindUnique.mockResolvedValueOnce({
      providerEnvironment: "PRODUCTION",
      payment: { isQaAcceptance: false },
    });

    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "live_attempt_ref_999", amount: 50000 },
    });
    const res = await POST(
      makeRequest(body, { "x-paystack-signature": signLegacy(body, QA_API_SECRET) }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      received: true,
      status: "IGNORED_NON_QA_SANDBOX_REFERENCE",
      reference: null,
    });
    expect(mocks.processPaystackWebhook).not.toHaveBeenCalled();
  });
});
