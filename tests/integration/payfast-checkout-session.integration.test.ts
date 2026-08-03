import { afterAll, describe, expect, it } from "vitest";
import { generatePayfastSignature } from "@/lib/payments/providers/payfast/payfast-signature";
import type { PayfastUnsignedFields } from "@/lib/payments/providers/payfast/payfast-fields";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { buildOwnedPayfastCheckoutAction } from "@/lib/services/payfast-checkout.service";
import { createPayableOrder, paymentPrisma } from "./payment-fixtures";
import {
  payfastIntegrationCallbacks,
  payfastIntegrationConfiguration,
  payfastIntegrationRegistry,
} from "./payfast-fixtures";

afterAll(async () => paymentPrisma.$disconnect());

describe("Phase 11 Payfast checkout session", () => {
  it("persists safe FORM_POST audit and reconstructs the exact signed form", async () => {
    const fixture = await createPayableOrder();
    const payment = await prepareOrderPayment(
      { id: fixture.user.id, email: fixture.user.email },
      { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:payfast:prepare` },
    );
    const registry = payfastIntegrationRegistry();
    const session = await createProviderCheckoutSession(
      { id: fixture.user.id },
      { paymentId: payment.id, provider: "PAYFAST", idempotencyKey: `${fixture.tag}:payfast:checkout` },
      { registry, callbackUrls: payfastIntegrationCallbacks },
    );
    expect(session).toMatchObject({
      paymentStatus: "REQUIRES_ACTION",
      attempt: {
        attemptNumber: 1,
        status: "REQUIRES_ACTION",
        providerEnvironment: "SANDBOX",
        checkoutActionType: "FORM_POST",
        redirectUrl: null,
      },
    });
    expect(session.attempt.merchantReference).toMatch(/^kt:payment:pay_[A-Za-z0-9_-]+:attempt:1$/);

    const action = await buildOwnedPayfastCheckoutAction(
      fixture.user.id,
      session.attempt.publicReference!,
      { registry, callbackUrls: payfastIntegrationCallbacks },
    );
    const requiredNames = [
      "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
      "email_address", "m_payment_id", "amount", "item_name", "signature",
    ];
    const allowedNames = new Set([...requiredNames, "name_first", "name_last", "item_description"]);
    expect(Object.keys(action.fields).filter((name) => !allowedNames.has(name))).toEqual([]);
    for (const name of requiredNames) expect(action.fields[name], name).toBeTruthy();
    expect(action.fields).toMatchObject({
      amount: "115.00",
      m_payment_id: session.attempt.merchantReference,
      email_address: fixture.user.email,
      signature: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
    expect(action.fields).not.toHaveProperty("passphrase");
    expect(action.fields).not.toHaveProperty("subscription_type");
    expect(action.fields).not.toHaveProperty("token");
    expect(action.fields).not.toHaveProperty("split_payment");
    expect(JSON.stringify(action.fields)).not.toContain(fixture.order.id);
    expect(JSON.stringify(action.fields)).not.toContain(payment.id);
    expect(JSON.stringify(action.fields)).not.toContain(session.attempt.id);

    const { signature, ...unsigned } = action.fields;
    expect(generatePayfastSignature(
      unsigned as PayfastUnsignedFields,
      payfastIntegrationConfiguration.passphrase,
    )).toBe(signature);

    const stored = await paymentPrisma.paymentAttempt.findUniqueOrThrow({ where: { id: session.attempt.id } });
    expect(JSON.stringify(stored)).not.toContain(signature);
    expect(JSON.stringify(stored)).not.toContain(payfastIntegrationConfiguration.merchantKey);
    expect(JSON.stringify(stored)).not.toContain(payfastIntegrationConfiguration.passphrase);
  });

  it("same-key replay keeps one attempt, merchant reference, action, and history set", async () => {
    const fixture = await createPayableOrder();
    const payment = await prepareOrderPayment(
      { id: fixture.user.id, email: fixture.user.email },
      { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:payfast:prepare` },
    );
    const input = {
      paymentId: payment.id,
      provider: "PAYFAST" as const,
      idempotencyKey: `${fixture.tag}:payfast:checkout`,
    };
    const registry = payfastIntegrationRegistry();
    const first = await createProviderCheckoutSession(
      { id: fixture.user.id }, input, { registry, callbackUrls: payfastIntegrationCallbacks },
    );
    const historyCount = await paymentPrisma.paymentStatusHistory.count({ where: { paymentId: payment.id } });
    const replay = await createProviderCheckoutSession(
      { id: fixture.user.id }, input, { registry, callbackUrls: payfastIntegrationCallbacks },
    );
    const firstAction = await buildOwnedPayfastCheckoutAction(
      fixture.user.id, first.attempt.publicReference!, { registry, callbackUrls: payfastIntegrationCallbacks },
    );
    const replayAction = await buildOwnedPayfastCheckoutAction(
      fixture.user.id, replay.attempt.publicReference!, { registry, callbackUrls: payfastIntegrationCallbacks },
    );
    expect(replay.attempt.publicReference).toBe(first.attempt.publicReference);
    expect(replay.attempt.merchantReference).toBe(first.attempt.merchantReference);
    expect(replayAction).toEqual(firstAction);
    expect(await paymentPrisma.paymentAttempt.count({ where: { paymentId: payment.id } })).toBe(1);
    expect(await paymentPrisma.paymentStatusHistory.count({ where: { paymentId: payment.id } })).toBe(historyCount);
  });
});
