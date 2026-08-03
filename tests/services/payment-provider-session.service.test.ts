import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { FakePaymentProvider } from "../payments/fake-payment-provider";

const mocks = vi.hoisted(() => ({ prisma: { $transaction: vi.fn() }, tx: {} as Record<string, unknown> }));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";

let payment: Record<string, unknown>;
let attempt: Record<string, unknown> | null;
let inTransaction = false;
const historyCreate = vi.fn();
const historyCreateMany = vi.fn();

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
          id: "attempt-1", ...data, providerReference: null, redirectUrl: null, expiresAt: null, providerStatusCode: null,
          checkoutActionType: null, checkoutPreparedAt: null,
          failureCategory: null, failureCode: null, failureMessage: null, requestSnapshot: null, resultSnapshot: null,
          startedAt: null, completedAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
        };
        return attempt;
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (!attempt) return { count: 0 };
        const increment = (data.version as { increment?: number } | undefined)?.increment ?? 0;
        attempt = { ...attempt, ...data, version: Number(attempt.version) + increment, updatedAt: new Date("2026-01-02") };
        return { count: 1 };
      }),
    },
    paymentStatusHistory: { create: historyCreate, createMany: historyCreateMany },
  };
  mocks.tx = tx;
  mocks.prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => {
    const paymentBefore = { ...payment };
    const attemptBefore = attempt ? { ...attempt } : null;
    inTransaction = true;
    try { return await callback(tx); }
    catch (error) { payment = paymentBefore; attempt = attemptBefore; throw error; }
    finally { inTransaction = false; }
  });
}

beforeEach(() => {
  vi.clearAllMocks(); attempt = null;
  payment = {
    id: "payment-1", publicReference: "pay_abcdefghijklmnop", userId: "payer-1", orderId: "order-1", provider: null,
    status: "CREATED", amount: new Prisma.Decimal("12.50"), currency: "ZAR", version: 0, latestAttemptNumber: 0,
    failedAt: null, expiresAt: null, order: { orderNumber: "KT-1" },
    user: { email: "payer@example.test", name: "Test Payer" },
  };
  installTransactionMock();
});

const callbackUrls = () => ({ returnUrl: "https://app.test/payments/payfast/return?payment=pay_abcdefghijklmnop", cancelUrl: "https://app.test/payments/payfast/cancel?payment=pay_abcdefghijklmnop", notificationUrl: "https://app.test/api/payments/payfast/itn", returnRouteId: "payfast-return" as const, cancelRouteId: "payfast-cancel" as const, notificationRouteId: "payfast-itn-reserved" as const });

describe("payment provider session service", () => {
  it("checks provider readiness before reserving an attempt", async () => {
    const registry = new PaymentProviderRegistry({ configuration: [{ code: "PAYFAST", configured: true, active: false, credentialVersionConfigured: true, sourceAddressTrustConfigured: true, itnVerificationImplemented: true, productionValidationApproved: false, environment: "production", errorCategory: "NONE", blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }] });
    await expect(createProviderCheckoutSession({ id: "payer-1" }, { paymentId: "payment-1", provider: "PAYFAST", idempotencyKey: "attempt:key:production" }, { registry, callbackUrls })).rejects.toMatchObject({ code: "PAYFAST_PRODUCTION_NOT_READY" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("reserves with a locked counter, calls the adapter outside transactions, and finalizes requires-action safely", async () => {
    const fake = new FakePaymentProvider("requires-action");
    const original = fake.createCheckoutSession.bind(fake);
    vi.spyOn(fake, "createCheckoutSession").mockImplementation(async (...args) => { expect(inTransaction).toBe(false); return original(...args); });
    const result = await createProviderCheckoutSession({ id: "payer-1" }, { paymentId: "payment-1", provider: "PAYFAST", idempotencyKey: "attempt:key:1" }, { registry: new PaymentProviderRegistry({ adapters: [fake] }), callbackUrls });
    expect(result).toMatchObject({ paymentStatus: "REQUIRES_ACTION", attempt: { attemptNumber: 1, status: "REQUIRES_ACTION", merchantReference: "kt:payment:pay_abcdefghijklmnop:attempt:1" } });
    expect(result.attempt).not.toHaveProperty("providerCredentialVersion");
    expect(fake.calls).toBe(1); expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(3); expect(historyCreate).toHaveBeenCalledOnce(); expect(historyCreateMany).toHaveBeenCalledOnce();
  });

  it("returns same-key final replay without a second provider call and rejects changed payment meaning", async () => {
    const fake = new FakePaymentProvider("processing"); const registry = new PaymentProviderRegistry({ adapters: [fake] });
    await createProviderCheckoutSession({ id: "payer-1" }, { paymentId: "payment-1", provider: "PAYFAST", idempotencyKey: "attempt:key:1" }, { registry, callbackUrls });
    const replay = await createProviderCheckoutSession({ id: "payer-1" }, { paymentId: "payment-1", provider: "PAYFAST", idempotencyKey: "attempt:key:1" }, { registry, callbackUrls });
    expect(replay.replayed).toBe(true); expect(fake.calls).toBe(1);
  });

  it("classifies a timeout as UNKNOWN/PROCESSING and never auto-creates a second attempt", async () => {
    const fake = new FakePaymentProvider("timeout");
    const result = await createProviderCheckoutSession({ id: "payer-1" }, { paymentId: "payment-1", provider: "PAYFAST", idempotencyKey: "attempt:key:2" }, { registry: new PaymentProviderRegistry({ adapters: [fake] }), callbackUrls });
    expect(result).toMatchObject({ paymentStatus: "PROCESSING", attempt: { status: "UNKNOWN", failureCategory: "TIMEOUT" } });
    expect(payment.latestAttemptNumber).toBe(1);
  });

  it("rolls back/propagates reservation and finalization failures through complete transaction mocks", async () => {
    (mocks.tx.paymentAttempt as { create: ReturnType<typeof vi.fn> }).create.mockRejectedValueOnce(new Error("reservation rollback"));
    await expect(createProviderCheckoutSession({ id: "payer-1" }, { paymentId: "payment-1", provider: "PAYFAST", idempotencyKey: "attempt:key:3" }, { registry: new PaymentProviderRegistry({ adapters: [new FakePaymentProvider("processing")] }), callbackUrls })).rejects.toThrow("reservation rollback");
    expect(attempt).toBeNull(); expect(payment).toMatchObject({ status: "CREATED", latestAttemptNumber: 0 });
  });

  it("leaves durable unresolved evidence when finalization rolls back", async () => {
    historyCreateMany.mockRejectedValueOnce(new Error("finalization rollback"));
    await expect(createProviderCheckoutSession({ id: "payer-1" }, { paymentId: "payment-1", provider: "PAYFAST", idempotencyKey: "attempt:key:4" }, { registry: new PaymentProviderRegistry({ adapters: [new FakePaymentProvider("processing")] }), callbackUrls })).rejects.toThrow("finalization rollback");
    expect(payment).toMatchObject({ status: "PROVIDER_PENDING", latestAttemptNumber: 1 });
    expect(attempt).toMatchObject({ status: "REQUESTING", merchantReference: "kt:payment:pay_abcdefghijklmnop:attempt:1" });
  });
});
