import { execFile } from "node:child_process";
import { createHmac } from "node:crypto";
import { promisify } from "node:util";
import { expect, type Page } from "@playwright/test";
import { login } from "./auth";
import { assertDisposablePaystackAcceptance } from "../../../lib/testing/disposable-paystack-policy";
const execute = promisify(execFile);
export type PaymentSnapshot = {
  checkout: { status: string; grandTotal: string };
  payment: { id: string; reference: string; status: string; amount: string; currency: string; successLedgerJournalId: string | null };
  attempt: { merchantReference: string; status: string };
  provider: { id: number; amount: number; currency: string; status: string; initializeCalls: number; verifyCalls: number };
  events: Array<{ processingStatus: string; signatureVerified: boolean; amountVerified: boolean; merchantVerified: boolean; providerDataVerified: boolean; ledgerJournalId: string | null; attemptCount: number }>;
  journals: Array<{ id: string; currency: string; totalDebits: string; totalCredits: string; entries: Array<{ direction: string; amount: string; account: { code: string } }> }>;
  orders: Array<{ id: string; publicReference: string; paymentId: string; currency: string; grandTotal: string; commercialFingerprint: string; guestCapabilityBound: boolean; storeOrders: Array<{ id: string; publicReference: string; lines: Array<{ id: string; quantity: number }>; settlementSnapshots: unknown[] }> }>;
  reservations: Array<{ status: string; items: Array<{ quantity: number; inventoryLevel: { id: string; onHand: number; reserved: number; available: number } }> }>;
  intents: Array<{ amount: string; currency: string; deliveries: Array<{ status: string }> }>;
};
export async function paymentControl(reference: string, action = "snapshot"): Promise<PaymentSnapshot> {
  assertDisposablePaystackAcceptance();
  const { stdout } = await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase2-paystack-control.ts", reference, action], { env: process.env, timeout: 45_000, maxBuffer: 2_000_000 });
  const line = stdout.split(/\r?\n/).find(value => value.startsWith("PAYSTACK_SNAPSHOT "));
  if (!line) throw new Error("Canonical PostgreSQL snapshot was not produced.");
  return JSON.parse(line.slice("PAYSTACK_SNAPSHOT ".length));
}
async function read(page: Page, reference: string) {
  const response = await page.request.get(`/api/checkout/${reference}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).checkout;
}
const operation = (version: number) => ({ checkoutVersion: version, operationId: crypto.randomUUID(), requestHash: crypto.randomUUID() });
export async function prepareCheckout(page: Page, suffix: string, width: number, guest = false, options: { baseLine?: { offerReference: string; variantReference: string; quantity: number; modifiers: unknown[] }; lines?: Array<{ offerReference: string; variantReference: string; quantity: number; modifiers: unknown[] }>; stopAfterReview?: boolean } = {}) {
  assertDisposablePaystackAcceptance();
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  const email = `e2e-paystack-${suffix}@ktcouriers.local`;
  if (guest) await page.context().clearCookies();
  else await login(page, email);
  const cartResponse = await page.request.get("/api/cart"); expect(cartResponse.status()).toBe(200);
  const cart = (await cartResponse.json()).cart;
  let line = await page.request.post("/api/cart/lines", { data: { ...(options.baseLine ?? { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 1, modifiers: [] }), operationId: crypto.randomUUID(), requestHash: crypto.randomUUID(), cartVersion: cart.version } });
  expect(line.status(), await line.text()).toBe(201);
  for (const selection of options.lines ?? []) {
    const current = await page.request.get("/api/cart");
    line = await page.request.post("/api/cart/lines", { data: { ...selection, operationId: crypto.randomUUID(), requestHash: crypto.randomUUID(), cartVersion: (await current.json()).cart.version } });
    expect(line.status(), await line.text()).toBe(201);
  }
  const created = await page.request.post("/api/checkout", { data: { cartReference: (await line.json()).cart.reference } });
  expect(created.status(), await created.text()).toBe(201);
  const reference = (await created.json()).checkout.reference as string;
  await page.goto(`/checkout?ref=${reference}`);
  await page.getByLabel("Recipient Full Name", { exact: true }).fill(`Disposable payment ${suffix}`);
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Phone Number (SA)", { exact: true }).fill("+27821112233");
  await page.getByRole("button", { name: /Continue to Delivery Address/ }).click();
  await expect(page.getByRole("heading", { name: "2. Delivery address", exact: true })).toBeFocused();
  if (guest) {
    const requested = await page.request.post(`/api/checkout/${reference}/contact-verification`, { data: { operationId: crypto.randomUUID() } });
    expect(requested.status(), await requested.text()).toBe(200);
    const { stdout } = await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase2-paystack-control.ts", reference, "guest-code"], { env: process.env, timeout: 45_000 });
    const codeLine = stdout.split(/\r?\n/).find(value => value.startsWith("PAYSTACK_GUEST_CODE "));
    if (!codeLine) throw new Error("Disposable guest challenge could not be read from its encrypted outbox.");
    const verified = await page.request.put(`/api/checkout/${reference}/contact-verification`, { data: JSON.parse(codeLine.slice("PAYSTACK_GUEST_CODE ".length)) });
    expect(verified.status(), await verified.text()).toBe(200); expect(await verified.json()).toEqual({ verified: true });
  }
  await page.getByLabel("Street Address (Line 1)", { exact: true }).fill("45 Commission St");
  await page.getByLabel("Suburb / Area", { exact: true }).fill("Central");
  await page.getByLabel("City", { exact: true }).fill("Johannesburg");
  await page.getByLabel("Province", { exact: true }).selectOption("Gauteng");
  await page.getByLabel("Postal Code", { exact: true }).fill("2001");
  await page.getByRole("button", { name: /Calculate Delivery/ }).click();
  await expect(page.getByRole("heading", { name: "3. Delivery options", exact: true })).toBeFocused();
  const reviewResponse = page.waitForResponse(response => response.url().endsWith(`/api/checkout/${reference}/review`) && response.request().method() === "POST");
  await page.getByRole("button", { name: /Review order/ }).click();
  const reviewed = await reviewResponse; expect(reviewed.status(), await reviewed.text()).toBe(200);
  const review = await reviewed.json();
  await expect(page.getByRole("heading", { name: "4. Review your order", exact: true })).toBeFocused();
  if (options.stopAfterReview) return { reference, review, baseline: undefined };
  const fresh = await read(page, reference);
  expect(fresh.totals.grandTotal).toBe(review.grandTotal);
  const acknowledged = await page.request.post(`/api/checkout/${reference}/acknowledge`, { data: { ...operation(fresh.version), reviewVersion: review.reviewVersion, commercialFingerprint: review.commercialFingerprint, acknowledgedTotalReference: review.grandTotal, ...review.legalEvidence } });
  expect(acknowledged.status(), await acknowledged.text()).toBe(200);
  const reserved = await page.request.post(`/api/checkout/${reference}/reserve`, { data: operation((await acknowledged.json()).checkoutVersion) });
  expect(reserved.status(), await reserved.text()).toBe(200);
  const prepared = await page.request.post(`/api/checkout/${reference}/prepare-payment`, { data: operation((await read(page, reference)).version) });
  expect(prepared.status(), await prepared.text()).toBe(200);
  const payment = await prepared.json();
  expect(payment).toMatchObject({ currency: "ZAR", amount: review.grandTotal, providerAction: { type: "REDIRECT_GET" } });
  expect(new URL(payment.providerAction.endpoint).hostname).toBe("checkout.paystack.com");
  const baseline = await paymentControl(reference);
  expect(baseline.provider).toMatchObject({ status: "pending", initializeCalls: 1, verifyCalls: 0 });
  expect(baseline.payment.status).not.toBe("SUCCEEDED");
  expect(baseline.journals).toHaveLength(0); expect(baseline.orders).toHaveLength(0); expect(baseline.intents).toHaveLength(0);
  await page.goto(`/checkout/paystack/return?payment=${payment.paymentReference}&status=success&paid=true`);
  await expect(page.getByRole("heading", { name: "We are confirming your payment", exact: true })).toBeVisible();
  expect((await paymentControl(reference)).payment.status).not.toBe("SUCCEEDED");
  return { reference, baseline };
}

export async function createPaidCheckout(page: Page, suffix: string, width: number) {
  const { reference, baseline } = await prepareCheckout(page, suffix, width);
  await paymentControl(reference, "success");
  if (!baseline) throw new Error("Payment preparation baseline is required.");
  const raw = JSON.stringify({ event: "charge.success", data: { id: baseline.provider.id, domain: "test", status: "success", reference: baseline.attempt.merchantReference, amount: baseline.provider.amount, currency: "ZAR" } });
  const response = await page.request.post("/api/payments/paystack/webhook", { data: raw, headers: { "content-type": "application/json", "x-paystack-signature": createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex") } });
  expect(response.status(), await response.text()).toBe(200);
  const snapshot = await paymentControl(reference, "process");
  expect(snapshot.payment.status).toBe("SUCCEEDED");
  expect(snapshot.journals).toHaveLength(1);
  expect(snapshot.orders).toHaveLength(1);
  expect(snapshot.journals[0].totalDebits).toBe(snapshot.journals[0].totalCredits);
  expect(snapshot.reservations[0].status).toBe("CONSUMED");
  return { reference, snapshot };
}
export type StoreSnapshot = {
  reference: string; status: string; acceptanceStatus: string; preparationStatus: string;
  resolutionStatus: string; financialResolutionStatus: string; deliveryBridgeStatus: string;
  lines: Array<{ id: string; quantity: number; fulfilment: { status: string; substitutionPreference: string; confirmedAvailableQuantity: number; resolvedFulfilmentQuantity: number }; issues: Array<{ publicReference: string; status: string }> }>;
  operations: Array<{ operationId: string; operationType: string }>;
  history: Array<{ operationId: string; eventType: string }>;
  cancellations: Array<{ status: string; operationId: string }>;
  adjustments: Array<{ publicReference: string; status: string; refundAmount: string; financialEvidence: unknown }>;
  proposals: Array<{ publicReference: string; status: string; customerCharge: string; reservation: { status: string } }>;
  reconciliation: Array<{ reasonCode: string; status: string }>;
  settlement: Array<{ status: string; commissionAccrualReference: string; storeEarningReference: string }>;
  payment: { status: string; totalRefundedAmount: string; totalRefundReservedAmount: string };
  journalCount: number; stock: Array<{ onHand: number; reserved: number; available: number }>;
};
export async function storeControl(reference: string, action = "snapshot"): Promise<StoreSnapshot> {
  assertDisposablePaystackAcceptance();
  const { stdout } = await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase2-store-order-control.ts", reference, action], { env: process.env, timeout: 60_000, maxBuffer: 2_000_000 });
  const line = stdout.split(/\r?\n/).find(value => value.startsWith("STORE_ORDER_SNAPSHOT "));
  if (!line) throw new Error("Canonical store-order snapshot was not produced.");
  return JSON.parse(line.slice("STORE_ORDER_SNAPSHOT ".length));
}
export async function prepareStoreOrder(page: Page, suffix: string, width: number) {
  const paid = await createPaidCheckout(page, suffix, width);
  const order = paid.snapshot.orders[0];
  const reference = order.storeOrders[0].publicReference;
  const baseline = await storeControl(reference, "initialize");
  expect(baseline.status).toBe("SETTLED");
  expect(baseline.settlement[0].status).toBe("COMPLETED");
  expect(baseline.acceptanceStatus).toBe("PENDING_STORE_REVIEW");
  return { ...paid, order, storeReference: reference, baseline };
}
export async function storeAction(page: Page, reference: string, body: Record<string, unknown>) {
  return page.request.post(`/api/store/orders/${reference}/actions`, { data: { operationId: crypto.randomUUID(), ...body }, headers: { origin: new URL(page.url()).origin } });
}
export async function customerAction(page: Page, order: string, reference: string, body: Record<string, unknown>) {
  return page.request.post(`/api/marketplace-orders/${order}/store-orders/${reference}/actions`, { data: { operationId: crypto.randomUUID(), ...body }, headers: { origin: new URL(page.url()).origin } });
}
