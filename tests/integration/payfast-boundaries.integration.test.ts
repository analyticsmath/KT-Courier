import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { POST as reservedItnPost } from "@/app/api/payments/payfast/itn/route";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { getCustomerPaymentStatus } from "@/lib/services/payment-customer-query.service";
import { buildOwnedPayfastCheckoutAction } from "@/lib/services/payfast-checkout.service";
import { createPayableOrder, paymentPrisma } from "./payment-fixtures";
import { payfastIntegrationCallbacks, payfastIntegrationRegistry } from "./payfast-fixtures";

afterAll(async () => paymentPrisma.$disconnect());

async function operationalSnapshot(orderId: string) {
  return Promise.all([
    paymentPrisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        status: true,
        currentDriverProfileId: true,
        pricingQuoteId: true,
        priceEstimate: true,
        pricingSnapshot: true,
        pricingSubtotal: true,
        pricingTaxAmount: true,
        pricingTaxRate: true,
        pricingQuote: { select: { status: true, total: true, usedAt: true, updatedAt: true } },
        _count: {
          select: {
            statusHistory: true,
            pricingAuditLogs: true,
            assignments: true,
            operationalEvents: true,
            driverOperationCommands: true,
          },
        },
      },
    }),
    paymentPrisma.ledgerJournal.count(),
    paymentPrisma.walletTransaction.count(),
    paymentPrisma.paymentWebhookEvent.count({ where: { provider: "PAYFAST" } }),
    paymentPrisma.driverProfile.findMany({
      select: { id: true, updatedAt: true, availability: true, availabilityRevision: true },
      orderBy: { id: "asc" },
    }),
  ]);
}

async function createActionableFixture() {
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
  return { fixture, payment, session, registry };
}

describe("Phase 11 Payfast cross-module and navigation boundaries", () => {
  it("wrong payer sees neither payment status nor the attempt action", async () => {
    const { payment, session, registry } = await createActionableFixture();
    await expect(getCustomerPaymentStatus("wrong-payer", payment.publicReference)).resolves.toBeNull();
    await expect(buildOwnedPayfastCheckoutAction(
      "wrong-payer",
      session.attempt.publicReference!,
      { registry, callbackUrls: payfastIntegrationCallbacks },
    )).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_NOT_FOUND" });
  });

  it("return-style owned status navigation mutates nothing", async () => {
    const { fixture, payment } = await createActionableFixture();
    const beforePayment = await paymentPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const beforeAttempt = await paymentPrisma.paymentAttempt.findMany({ where: { paymentId: payment.id } });
    const beforeOperations = await operationalSnapshot(fixture.order.id);
    await expect(getCustomerPaymentStatus(fixture.user.id, payment.publicReference)).resolves.toMatchObject({
      status: "REQUIRES_ACTION",
    });
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toEqual(beforePayment);
    expect(await paymentPrisma.paymentAttempt.findMany({ where: { paymentId: payment.id } })).toEqual(beforeAttempt);
    expect(await operationalSnapshot(fixture.order.id)).toEqual(beforeOperations);
  });

  it("cancel-style owned status navigation mutates nothing", async () => {
    const { fixture, payment } = await createActionableFixture();
    const beforePayment = await paymentPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const beforeOperations = await operationalSnapshot(fixture.order.id);
    await getCustomerPaymentStatus(fixture.user.id, payment.publicReference);
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toEqual(beforePayment);
    expect(await operationalSnapshot(fixture.order.id)).toEqual(beforeOperations);
  });

  it("reserved ITN returns non-success without payment, attempt, order, wallet, or ledger mutation", async () => {
    const { fixture, payment } = await createActionableFixture();
    const beforePayment = await paymentPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const beforeAttempts = await paymentPrisma.paymentAttempt.findMany({ where: { paymentId: payment.id } });
    const beforeOperations = await operationalSnapshot(fixture.order.id);
    const response = await reservedItnPost(new NextRequest(
      "https://app.example.test/api/payments/payfast/itn",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": "12" },
        body: "ignored=true",
      },
    ));
    expect([400, 501]).toContain(response.status);
    expect(await paymentPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toEqual(beforePayment);
    expect(await paymentPrisma.paymentAttempt.findMany({ where: { paymentId: payment.id } })).toEqual(beforeAttempts);
    expect(await operationalSnapshot(fixture.order.id)).toEqual(beforeOperations);
  });

  it("checkout changes no ledger, wallet, order, pricing, dispatch, or driver state", async () => {
    const fixture = await createPayableOrder();
    const payment = await prepareOrderPayment(
      { id: fixture.user.id, email: fixture.user.email },
      { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:payfast:prepare` },
    );
    const before = await operationalSnapshot(fixture.order.id);
    await createProviderCheckoutSession(
      { id: fixture.user.id },
      { paymentId: payment.id, provider: "PAYFAST", idempotencyKey: `${fixture.tag}:payfast:checkout` },
      { registry: payfastIntegrationRegistry(), callbackUrls: payfastIntegrationCallbacks },
    );
    expect(await operationalSnapshot(fixture.order.id)).toEqual(before);
  });
});
