import { afterAll, describe, expect, it } from "vitest";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { resolvePayfastConfiguration } from "@/lib/payments/providers/payfast/payfast-config";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { createPayableOrder, paymentPrisma } from "./payment-fixtures";
import {
  payfastIntegrationCallbacks,
  payfastIntegrationConfiguration,
  payfastIntegrationRegistry,
} from "./payfast-fixtures";

afterAll(async () => paymentPrisma.$disconnect());

describe("Phase 11 Payfast configuration integration", () => {
  it("exposes deterministic sandbox readiness without secrets", () => {
    const ready = payfastIntegrationRegistry().readiness()[0];
    expect(ready).toMatchObject({
      configured: true,
      active: true,
      environment: "test-injected",
      capabilities: { supportsFormPostCheckout: true },
    });
    expect(JSON.stringify(ready)).not.toContain(payfastIntegrationConfiguration.merchantKey);
    expect(JSON.stringify(ready)).not.toContain(payfastIntegrationConfiguration.passphrase);
  });

  it("configuration failure creates no attempt or provider-pending transition", async () => {
    const fixture = await createPayableOrder();
    const payment = await prepareOrderPayment(
      { id: fixture.user.id, email: fixture.user.email },
      { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:payfast:prepare` },
    );
    const invalid = resolvePayfastConfiguration({
      PAYFAST_MODE: "sandbox",
      PAYFAST_MERCHANT_ID: "id",
      PAYFAST_MERCHANT_KEY: "key",
      PAYMENT_APP_ORIGIN: "https://app.example.test",
    });
    const registry = new PaymentProviderRegistry({ configuration: [invalid.state] });
    await expect(createProviderCheckoutSession(
      { id: fixture.user.id },
      { paymentId: payment.id, provider: "PAYFAST", idempotencyKey: `${fixture.tag}:payfast:checkout` },
      { registry, callbackUrls: payfastIntegrationCallbacks },
    )).rejects.toMatchObject({ code: "PAYFAST_CONFIGURATION_INVALID" });
    expect(await paymentPrisma.paymentAttempt.count({ where: { paymentId: payment.id } })).toBe(0);
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: "CREATED",
      latestAttemptNumber: 0,
    });
  });

  it("production lock creates no attempt despite complete credentials", async () => {
    const fixture = await createPayableOrder();
    const payment = await prepareOrderPayment(
      { id: fixture.user.id, email: fixture.user.email },
      { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:payfast:prepare` },
    );
    const resolution = resolvePayfastConfiguration({
      PAYFAST_MODE: "production",
      PAYFAST_MERCHANT_ID: "id",
      PAYFAST_MERCHANT_KEY: "key",
      PAYFAST_PASSPHRASE: "passphrase",
      PAYFAST_CREDENTIAL_VERSION: "production-v1",
      PAYMENT_PROXY_MODE: "single_trusted_proxy",
      PAYMENT_APP_ORIGIN: "https://app.example.test",
    });
    const registry = new PaymentProviderRegistry({ configuration: [resolution.state] });
    expect(registry.readiness()[0]).toMatchObject({
      configured: true,
      active: false,
      environment: "production",
      blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED",
    });
    await expect(createProviderCheckoutSession(
      { id: fixture.user.id },
      { paymentId: payment.id, provider: "PAYFAST", idempotencyKey: `${fixture.tag}:payfast:checkout` },
      { registry, callbackUrls: payfastIntegrationCallbacks },
    )).rejects.toMatchObject({ code: "PAYFAST_PRODUCTION_NOT_READY" });
    expect(await paymentPrisma.paymentAttempt.count({ where: { paymentId: payment.id } })).toBe(0);
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: "CREATED",
      latestAttemptNumber: 0,
    });
  });
});
