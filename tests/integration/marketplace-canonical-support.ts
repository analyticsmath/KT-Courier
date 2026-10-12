import { chromium, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { expect } from "vitest";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";
import { prepareCheckout, paymentControl } from "../e2e/fixtures/store-order";

export async function withCanonicalBrowser(work: (page: Page) => Promise<void>) {
  assertDisposablePaystackAcceptance();
  if (!process.env.E2E_BASE_URL) throw new Error("Canonical persistence acceptance requires the disposable HTTP application.");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  try { await work(await context.newPage()); }
  finally { await context.close(); await browser.close(); }
}

export async function canonicalPaidBasket(page: Page, suffix: string, options: Parameters<typeof prepareCheckout>[4] = {}) {
  const { reference, baseline } = await prepareCheckout(page, suffix, 390, false, options);
  if (!baseline) throw new Error("A prepared payment is required.");
  await paymentControl(reference, "success");
  const raw = JSON.stringify({ event: "charge.success", data: { id: baseline.provider.id, domain: "test", status: "success", reference: baseline.attempt.merchantReference, amount: baseline.provider.amount, currency: "ZAR" } });
  const response = await page.request.post("/api/payments/paystack/webhook", { data: raw, headers: { "content-type": "application/json", "x-paystack-signature": createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex") } });
  expect(response.status(), await response.text()).toBe(200);
  const paid = await paymentControl(reference, "process");
  expect(paid.payment.status).toBe("SUCCEEDED");
  expect(paid.events).toEqual(expect.arrayContaining([expect.objectContaining({ processingStatus: "APPLIED", signatureVerified: true, providerDataVerified: true })]));
  expect(paid.journals).toHaveLength(1);
  expect(paid.journals[0].totalDebits).toBe(paid.journals[0].totalCredits);
  expect(paid.orders).toHaveLength(1);
  expect(paid.reservations[0].status).toBe("CONSUMED");
  return { reference, baseline, paid };
}
