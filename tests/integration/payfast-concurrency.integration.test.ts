import { afterAll, describe, expect, it } from "vitest";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { createPayableOrder, paymentPrisma } from "./payment-fixtures";
import { payfastIntegrationCallbacks, payfastIntegrationRegistry } from "./payfast-fixtures";

afterAll(async () => paymentPrisma.$disconnect());

describe("Phase 11 Payfast attempt concurrency", () => {
  it("converges same-key races onto one attempt", async () => {
    const fixture = await createPayableOrder();
    const payment = await prepareOrderPayment(
      { id: fixture.user.id, email: fixture.user.email },
      { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:payfast:prepare` },
    );
    const input = {
      paymentId: payment.id,
      provider: "PAYFAST" as const,
      idempotencyKey: `${fixture.tag}:payfast:race`,
    };
    const settled = await Promise.all([
      createProviderCheckoutSession(
        { id: fixture.user.id }, input,
        { registry: payfastIntegrationRegistry(), callbackUrls: payfastIntegrationCallbacks },
      ),
      createProviderCheckoutSession(
        { id: fixture.user.id }, input,
        { registry: payfastIntegrationRegistry(), callbackUrls: payfastIntegrationCallbacks },
      ),
    ]);
    expect(new Set(settled.map((entry) => entry.attempt.id)).size).toBe(1);
    expect(await paymentPrisma.paymentAttempt.count({ where: { paymentId: payment.id } })).toBe(1);
  });

  it("allows at most one different-key winner with no duplicate attempt number or merchant reference", async () => {
    const fixture = await createPayableOrder();
    const payment = await prepareOrderPayment(
      { id: fixture.user.id, email: fixture.user.email },
      { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:payfast:prepare` },
    );
    const settled = await Promise.allSettled([
      createProviderCheckoutSession(
        { id: fixture.user.id },
        { paymentId: payment.id, provider: "PAYFAST", idempotencyKey: `${fixture.tag}:payfast:race:a` },
        { registry: payfastIntegrationRegistry(), callbackUrls: payfastIntegrationCallbacks },
      ),
      createProviderCheckoutSession(
        { id: fixture.user.id },
        { paymentId: payment.id, provider: "PAYFAST", idempotencyKey: `${fixture.tag}:payfast:race:b` },
        { registry: payfastIntegrationRegistry(), callbackUrls: payfastIntegrationCallbacks },
      ),
    ]);
    expect(settled.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const attempts = await paymentPrisma.paymentAttempt.findMany({ where: { paymentId: payment.id } });
    expect(attempts).toHaveLength(1);
    expect(new Set(attempts.map((entry) => entry.attemptNumber)).size).toBe(attempts.length);
    expect(new Set(attempts.map((entry) => entry.merchantReference)).size).toBe(attempts.length);
  });
});
