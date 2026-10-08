import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/db/prisma";
import { withCanonicalBrowser, canonicalPaidBasket } from "./marketplace-canonical-support";
import { prepareCheckout } from "../e2e/fixtures/store-order";

describe("Paystack residual canonical PostgreSQL acceptance", () => {
  for (const [suffix, price, commission, earning] of [["one", "0.01", "0.01", "0.00"], ["two", "0.02", "0.01", "0.01"], ["three", "0.03", "0.02", "0.01"], ["large", "9000000.01", "4500000.01", "4500000.00"]]) {
    it(`freezes exact ${price} seller basis and rounded commission without drift`, () => withCanonicalBrowser(async page => {
      const f = await canonicalPaidBasket(page, `pg-residual-${suffix}`, { baseLine: { offerReference: `CO-RESIDUAL-${suffix}`, variantReference: `CV-RESIDUAL-${suffix}`, quantity: 1, modifiers: [] } });
      const frozen = await prisma.marketplaceSettlementSnapshot.findFirstOrThrow({ where: { sourceCheckout: { publicReference: f.reference } } });
      expect(frozen.sellerBasis.toFixed(2)).toBe(price);
      expect(frozen.commissionAmount.toFixed(2)).toBe(commission);
      expect(frozen.storeEarningAmount.toFixed(2)).toBe(earning);
      expect(frozen.sellerBasis.sub(frozen.commissionAmount).equals(frozen.storeEarningAmount)).toBe(true);
      expect(f.paid.provider.initializeCalls).toBe(1); expect(f.paid.provider.verifyCalls).toBe(1);
      expect(frozen.sourcePaymentId).toBe(f.paid.payment.id);
      expect(f.paid.journals[0].totalDebits).toBe(f.paid.payment.amount);
    }), 180_000);
  }

  it("replays reservation and payment commands while rejecting changed command hashes", () => withCanonicalBrowser(async page => {
    const f = await prepareCheckout(page, "pg-residual-hash", 390, false, { stopAfterReview: true });
    const read = async () => (await (await page.request.get(`/api/checkout/${f.reference}`)).json()).checkout;
    const command = (version: number) => ({ checkoutVersion: version, operationId: randomUUID(), requestHash: randomUUID() });
    const ack = await page.request.post(`/api/checkout/${f.reference}/acknowledge`, { data: { ...command((await read()).version), reviewVersion: f.review.reviewVersion, commercialFingerprint: f.review.commercialFingerprint, acknowledgedTotalReference: f.review.grandTotal, ...f.review.legalEvidence } });
    expect(ack.status(), await ack.text()).toBe(200);
    const reserve = command((await ack.json()).checkoutVersion);
    const reserved = await page.request.post(`/api/checkout/${f.reference}/reserve`, { data: reserve });
    expect(reserved.status(), await reserved.text()).toBe(200);
    const replay = await page.request.post(`/api/checkout/${f.reference}/reserve`, { data: reserve });
    expect(replay.status(), await replay.text()).toBe(200); expect(await replay.json()).toEqual(await reserved.json());
    const conflict = await page.request.post(`/api/checkout/${f.reference}/reserve`, { data: { ...reserve, requestHash: randomUUID() } });
    expect(conflict.status()).toBe(409);
    const prepare = command((await read()).version);
    const results = await Promise.all([1, 2].map(() => page.request.post(`/api/checkout/${f.reference}/prepare-payment`, { data: prepare })));
    expect(results.map(result => result.status())).toEqual([200, 200]);
    expect(await results[0].json()).toEqual(await results[1].json());
    const changed = await page.request.post(`/api/checkout/${f.reference}/prepare-payment`, { data: { ...prepare, requestHash: randomUUID() } });
    expect(changed.status()).toBe(409);
    const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { publicReference: f.reference } });
    expect(await prisma.payment.count({ where: { marketplaceCheckoutId: checkout.id } })).toBe(1);
    expect(await prisma.paymentAttempt.count({ where: { payment: { marketplaceCheckoutId: checkout.id } } })).toBe(1);
    expect(await prisma.marketplaceInventoryReservation.count({ where: { checkoutId: checkout.id } })).toBe(1);
  }), 180_000);

  it("rejects an expired quote before first provider initialization and financial writes", () => withCanonicalBrowser(async page => {
    const f = await prepareCheckout(page, "pg-residual-stale", 390, false, { stopAfterReview: true });
    const read = async () => (await (await page.request.get(`/api/checkout/${f.reference}`)).json()).checkout;
    const command = (version: number) => ({ checkoutVersion: version, operationId: randomUUID(), requestHash: randomUUID() });
    const ack = await page.request.post(`/api/checkout/${f.reference}/acknowledge`, { data: { ...command((await read()).version), reviewVersion: f.review.reviewVersion, commercialFingerprint: f.review.commercialFingerprint, acknowledgedTotalReference: f.review.grandTotal, ...f.review.legalEvidence } });
    expect(ack.status(), await ack.text()).toBe(200);
    const reserve = await page.request.post(`/api/checkout/${f.reference}/reserve`, { data: command((await ack.json()).checkoutVersion) });
    expect(reserve.status(), await reserve.text()).toBe(200);
    const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { publicReference: f.reference }, include: { storeGroups: true } });
    await prisma.pricingQuote.update({ where: { id: checkout.storeGroups[0].deliveryQuoteReference! }, data: { expiresAt: new Date(0) } });
    const prepared = await page.request.post(`/api/checkout/${f.reference}/prepare-payment`, { data: command((await read()).version) });
    expect(prepared.status(), await prepared.text()).toBe(422);
    expect((await prepared.json()).code).toBe("CHECKOUT_REVIEW_REQUIRED");
    expect(await prisma.payment.count({ where: { marketplaceCheckoutId: checkout.id } })).toBe(0);
    expect(await prisma.marketplaceOrder.count({ where: { checkoutId: checkout.id } })).toBe(0);
    const reservation = await prisma.marketplaceInventoryReservation.findFirstOrThrow({ where: { checkoutId: checkout.id } });
    expect(reservation.status).toBe("ACTIVE"); expect(reservation.expiresAt).toBeInstanceOf(Date);
  }), 180_000);
});
