import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { FakePaymentProvider } from "../payments/fake-payment-provider";
import { createPayableOrder, paymentPrisma, resetPaymentTables, testCallbackUrls } from "./payment-fixtures";
afterAll(async () => paymentPrisma.$disconnect());
beforeEach(async () => resetPaymentTables());
async function prepared(outcome: ConstructorParameters<typeof FakePaymentProvider>[0]) { const fixture = await createPayableOrder(); const payment = await prepareOrderPayment({ id: fixture.user.id, email: fixture.user.email }, { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:prepare` }); const fake = new FakePaymentProvider(outcome); return { fixture, payment, fake, registry: new PaymentProviderRegistry({ adapters: [fake] }) }; }
describe("Phase 10 live provider attempts", () => {
  it.each([["requires-action", "REQUIRES_ACTION"], ["processing", "PROCESSING"], ["failure", "FAILED"], ["timeout", "UNKNOWN"], ["malformed", "UNKNOWN"]] as const)("normalizes %s as %s without accounting/order effects", async (outcome, attemptStatus) => { const { fixture, payment, fake, registry } = await prepared(outcome); const result = await createProviderCheckoutSession({ id: fixture.user.id }, { paymentId: payment.id, provider: "PAYFAST", idempotencyKey: `${fixture.tag}:attempt` }, { registry, callbackUrls: testCallbackUrls }); expect(result.attempt.status).toBe(attemptStatus); expect(fake.calls).toBe(1); expect(await paymentPrisma.ledgerJournal.count()).toBe(0); expect((await paymentPrisma.order.findUniqueOrThrow({ where: { id: fixture.order.id } })).status).toBe("PENDING"); });
  it("replays a provider-session command with one attempt, one call, and stable references", async () => { const { fixture, payment, fake, registry } = await prepared("requires-action"); const input = { paymentId: payment.id, provider: "PAYFAST" as const, idempotencyKey: `${fixture.tag}:attempt` }; const first = await createProviderCheckoutSession({ id: fixture.user.id }, input, { registry, callbackUrls: testCallbackUrls }); const second = await createProviderCheckoutSession({ id: fixture.user.id }, input, { registry, callbackUrls: testCallbackUrls }); expect(second.attempt.id).toBe(first.attempt.id); expect(second.attempt.merchantReference).toBe(first.attempt.merchantReference); expect(fake.calls).toBe(1); });
});

