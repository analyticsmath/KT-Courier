import { createHmac } from "node:crypto";
import { request, type APIRequestContext } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";
import { assertDisposablePaystackAcceptance, disposablePaystackKey } from "../../lib/testing/disposable-paystack-policy";
import type { DisposablePaystackTransaction } from "../../lib/testing/disposable-paystack-provider";
import { claimPaystackWebhookEventsBatch, processClaimedPaystackWebhookEvent } from "../../lib/services/paystack-webhook-application.service";
import { consumeVerifiedPaymentEvents } from "../../lib/payments/verified-payment-event-processor.service";
import { prepareMarketplacePayment } from "../../lib/services/payment-preparation.service";
import { createMarketplaceProviderCheckoutSession } from "../../lib/services/payment-provider-session.service";

// Executed by the named disposable browser runner before its focused browser
// selection. This is real PostgreSQL/HTTP/canonical services, with no DB/client
// mocks and no direct successful payment/order fixture mutations.
const op = (version: number) => ({ checkoutVersion: version, operationId: crypto.randomUUID(), requestHash: crypto.randomUUID() });
async function checkout(api: APIRequestContext, reference: string) {
  const response = await api.get(`/api/checkout/${reference}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).checkout;
}
async function prepare(api: APIRequestContext, suffix: string) {
  const email = `e2e-paystack-pg-${suffix}@ktcouriers.local`;
  const login = await api.post("/api/auth/login", { data: { email, password: "ChangeMe123!" } });
  expect(login.status(), await login.text()).toBe(200);
  const cart = (await (await api.get("/api/cart")).json()).cart;
  const line = await api.post("/api/cart/lines", { data: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 1, modifiers: [], operationId: crypto.randomUUID(), requestHash: crypto.randomUUID(), cartVersion: cart.version } });
  expect(line.status(), await line.text()).toBe(201);
  const created = await api.post("/api/checkout", { data: { cartReference: (await line.json()).cart.reference } });
  expect(created.status(), await created.text()).toBe(201);
  const reference = (await created.json()).checkout.reference as string;
  const contact = await api.put(`/api/checkout/${reference}/contact`, { data: { ...op((await checkout(api, reference)).version), recipientName: "Disposable PG payment", email, phone: "+27821112233", preferredContactMethod: "EMAIL" } });
  expect(contact.status(), await contact.text()).toBe(200);
  const address = await api.put(`/api/checkout/${reference}/delivery-address`, { data: { ...op((await checkout(api, reference)).version), recipientName: "Disposable PG payment", line1: "45 Commission St", suburb: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001" } });
  expect(address.status(), await address.text()).toBe(200);
  const selection = await api.put(`/api/checkout/${reference}/delivery-options`, { data: op((await checkout(api, reference)).version) });
  expect(selection.status(), await selection.text()).toBe(200);
  const reviewed = await api.post(`/api/checkout/${reference}/review`, { data: op((await checkout(api, reference)).version) });
  expect(reviewed.status(), await reviewed.text()).toBe(200); const review = await reviewed.json();
  const acknowledged = await api.post(`/api/checkout/${reference}/acknowledge`, { data: { ...op((await checkout(api, reference)).version), reviewVersion: review.reviewVersion, commercialFingerprint: review.commercialFingerprint, acknowledgedTotalReference: review.grandTotal, ...review.legalEvidence } });
  expect(acknowledged.status(), await acknowledged.text()).toBe(200);
  const reserved = await api.post(`/api/checkout/${reference}/reserve`, { data: op((await acknowledged.json()).checkoutVersion) });
  expect(reserved.status(), await reserved.text()).toBe(200);
  const prepared = await api.post(`/api/checkout/${reference}/prepare-payment`, { data: op((await checkout(api, reference)).version) });
  expect(prepared.status(), await prepared.text()).toBe(200);
  const payment = await prepared.json();
  const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { paymentId: payment.paymentId }, orderBy: { attemptNumber: "desc" } });
  const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key: disposablePaystackKey(attempt.merchantReference) } });
  return { reference, payment, attempt, provider: row.value as unknown as DisposablePaystackTransaction };
}
async function processInbox(reference: string) {
  const batches = await Promise.all([1, 2].map(async () => {
    const claimed = await claimPaystackWebhookEventsBatch({ merchantReferences: [reference], batchSize: 10 });
    await Promise.all(claimed.map(event => processClaimedPaystackWebhookEvent(event)));
    return claimed.map(event => event.id);
  }));
  expect(batches[0].filter(id => batches[1].includes(id))).toEqual([]);
  await consumeVerifiedPaymentEvents({ limit: 10, subjectTypes: ["MARKETPLACE_CHECKOUT"] });
}
describe("canonical Paystack real PostgreSQL acceptance", () => {
  for (const outcome of ["success", "unknown"] as const) it(`persists ${outcome} through signed intake, independent Verify and canonical effects`, async () => {
    assertDisposablePaystackAcceptance();
    const api = await request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL, extraHTTPHeaders: { Origin: process.env.PLAYWRIGHT_BASE_URL! } });
    try {
      const { reference, payment, attempt, provider } = await prepare(api, outcome);
      const baseline = await prisma.marketplaceInventoryReservation.findFirstOrThrow({ where: { checkout: { publicReference: reference } }, include: { items: { include: { inventoryLevel: true } } } });
      const source = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { publicReference: reference } });
      // A changed frozen amount must roll back payment preparation, even when
      // reusing its source/operation; no second payment can be manufactured.
      await expect(prepareMarketplacePayment({ checkoutId: source.id, checkoutReference: reference, customerUserId: source.customerUserId, guestAccessTokenHash: null, payerEmail: provider.email, amount: source.grandTotal.add("0.01").toFixed(2), currency: "ZAR", commercialFingerprint: source.acceptedFingerprint!, operationId: crypto.randomUUID() })).rejects.toThrow();
      expect(await prisma.payment.count({ where: { marketplaceCheckoutId: source.id } })).toBe(1);
      await prisma.systemSetting.update({ where: { key: disposablePaystackKey(attempt.merchantReference) }, data: { value: { ...provider, status: outcome } } });
      const body = JSON.stringify({ event: "charge.success", data: { id: provider.id, domain: "test", status: "success", reference: attempt.merchantReference, amount: provider.amount, currency: "ZAR" } });
      const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(body).digest("hex");
      const responses = await Promise.all([1, 2].map(() => api.post("/api/payments/paystack/webhook", { data: body, headers: { "content-type": "application/json", "x-paystack-signature": signature } })));
      for (const response of responses) expect(response.status(), await response.text()).toBe(200);
      expect(await prisma.ledgerJournal.count({ where: { correlationId: payment.paymentReference } })).toBe(0);
      await processInbox(attempt.merchantReference);
      if (outcome === "success") {
        for (let i = 0; i < 50; i++) {
          if (await prisma.paymentVerifiedEventIntent.count({ where: { paymentId: payment.paymentId, deliveries: { some: { status: "COMPLETED" } } } })) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.paymentId } });
      const freshAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      expect(freshAttempt.providerReference).toBe(attempt.providerReference);
      const events = await prisma.paymentWebhookEvent.findMany({ where: { merchantReference: attempt.merchantReference } });
      const journals = await prisma.ledgerJournal.findMany({ where: { correlationId: payment.paymentReference, type: "EXTERNAL_PAYMENT_RECEIPT" }, include: { entries: true } });
      const orders = await prisma.marketplaceOrder.findMany({ where: { checkoutId: source.id } });
      const reservation = await prisma.marketplaceInventoryReservation.findUniqueOrThrow({ where: { id: baseline.id }, include: { items: { include: { inventoryLevel: true } } } });
      expect(events).toHaveLength(1); expect(events[0].attemptCount).toBe(1);
      expect(events[0].normalizedStatus).toBe("COMPLETE");
      if (outcome === "unknown") {
        expect(fresh.status).not.toBe("SUCCEEDED"); expect(fresh.successLedgerJournalId).toBeNull();
        expect(events[0].processingStatus).toBe("RECONCILIATION_REQUIRED"); expect(journals).toHaveLength(0); expect(orders).toHaveLength(0);
        expect(reservation).toEqual(baseline);
        await expect(createMarketplaceProviderCheckoutSession({ paymentId: fresh.id, idempotencyKey: crypto.randomUUID(), payerEmail: provider.email, guestCheckoutEvidence: false })).rejects.toThrow();
        expect(await prisma.paymentAttempt.count({ where: { paymentId: fresh.id } })).toBe(1);
      } else {
        expect(fresh.status).toBe("SUCCEEDED"); expect(events[0].processingStatus).toBe("APPLIED");
        expect(events[0]).toMatchObject({ signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true });
        expect(journals).toHaveLength(1); expect(journals[0].currency).toBe("ZAR");
        expect(journals[0].totalDebits.equals(fresh.amount)).toBe(true); expect(journals[0].totalCredits.equals(fresh.amount)).toBe(true);
        expect(journals[0].entries).toHaveLength(2); expect(orders).toHaveLength(1); expect(orders[0].grandTotal.equals(fresh.amount)).toBe(true);
        expect(fresh.marketplaceOrderId).toBe(orders[0].id);
        await expect(prisma.payment.update({ where: { id: fresh.id }, data: { marketplaceOrderId: null } })).rejects.toThrow("binding is immutable");
        await expect(prisma.payment.update({ where: { id: fresh.id }, data: { marketplaceOrderId: crypto.randomUUID() } })).rejects.toThrow("binding is immutable");
        await expect(prisma.payment.update({ where: { id: fresh.id }, data: { amount: fresh.amount.add("0.01") } })).rejects.toThrow("Succeeded payment evidence is immutable");
        expect(reservation.status).toBe("CONSUMED");
        for (const item of reservation.items) {
          const before = baseline.items.find(value => value.inventoryLevelId === item.inventoryLevelId)!;
          expect(item.inventoryLevel.onHand).toBe(before.inventoryLevel.onHand - item.quantity);
          expect(item.inventoryLevel.reserved).toBe(before.inventoryLevel.reserved - item.quantity);
          expect(item.inventoryLevel.available).toBe(before.inventoryLevel.available);
        }
        expect(await prisma.paymentVerifiedEventIntent.count({ where: { paymentId: fresh.id, deliveries: { some: { status: "COMPLETED" } } } })).toBe(1);
        expect((await api.post("/api/payments/paystack/webhook", { data: body, headers: { "content-type": "application/json", "x-paystack-signature": signature } })).status()).toBe(200);
        await processInbox(attempt.merchantReference);
        expect(await prisma.marketplaceOrder.count({ where: { checkoutId: source.id } })).toBe(1);
        expect(await prisma.ledgerJournal.count({ where: { correlationId: fresh.publicReference, type: "EXTERNAL_PAYMENT_RECEIPT" } })).toBe(1);
        expect(await prisma.marketplaceInventoryReservation.findUniqueOrThrow({ where: { id: baseline.id }, include: { items: { include: { inventoryLevel: true } } } })).toEqual(reservation);
      }
      const verified = (await prisma.systemSetting.findUniqueOrThrow({ where: { key: disposablePaystackKey(attempt.merchantReference) } })).value as unknown as DisposablePaystackTransaction;
      expect(verified.verifyCalls).toBeGreaterThan(0); expect(verified.initializeCalls).toBe(1);
    } finally { await api.dispose(); }
  }, 90_000);
});
