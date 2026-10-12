import { execFile } from "node:child_process";
import { createHmac } from "node:crypto";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";

const execute = promisify(execFile);
type Snapshot = {
  checkout: { status: string; grandTotal: string };
  payment: { id: string; reference: string; status: string; amount: string; currency: string; successLedgerJournalId: string | null };
  attempt: { merchantReference: string; status: string };
  provider: { id: number; amount: number; currency: string; status: string; initializeCalls: number; verifyCalls: number };
  events: Array<{ processingStatus: string; signatureVerified: boolean; amountVerified: boolean; merchantVerified: boolean; providerDataVerified: boolean; ledgerJournalId: string | null; attemptCount: number }>;
  journals: Array<{ id: string; currency: string; totalDebits: string; totalCredits: string; entries: Array<{ direction: string; amount: string; account: { code: string } }> }>;
  orders: Array<{ id: string; publicReference: string; paymentId: string; currency: string; grandTotal: string; commercialFingerprint: string; guestCapabilityBound: boolean; storeOrders: Array<{ lines: unknown[]; settlementSnapshots: unknown[] }> }>;
  reservations: Array<{ status: string; items: Array<{ quantity: number; inventoryLevel: { id: string; onHand: number; reserved: number; available: number } }> }>;
  intents: Array<{ amount: string; currency: string; deliveries: Array<{ status: string }> }>;
};
async function control(reference: string, action = "snapshot"): Promise<Snapshot> {
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
async function prepare(page: Page, suffix: string, width: number, guest = false) {
  assertDisposablePaystackAcceptance();
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  const email = `e2e-paystack-${suffix}@ktcouriers.local`;
  if (guest) await page.context().clearCookies();
  else await login(page, email);
  const cartResponse = await page.request.get("/api/cart"); expect(cartResponse.status()).toBe(200);
  const cart = (await cartResponse.json()).cart;
  const line = await page.request.post("/api/cart/lines", { data: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 1, modifiers: [], operationId: crypto.randomUUID(), requestHash: crypto.randomUUID(), cartVersion: cart.version } });
  expect(line.status(), await line.text()).toBe(201);
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
  const baseline = await control(reference);
  expect(baseline.provider).toMatchObject({ status: "pending", initializeCalls: 1, verifyCalls: 0 });
  expect(baseline.payment.status).not.toBe("SUCCEEDED");
  expect(baseline.journals).toHaveLength(0); expect(baseline.orders).toHaveLength(0); expect(baseline.intents).toHaveLength(0);
  await page.goto(`/checkout/paystack/return?payment=${payment.paymentReference}&status=success&paid=true`);
  await expect(page.getByRole("heading", { name: "We are confirming your payment", exact: true })).toBeVisible();
  expect(protectedState(await control(reference))).toEqual(protectedState(baseline));
  return { reference, baseline };
}
function protectedState(snapshot: Snapshot) {
  return { payment: snapshot.payment, orders: snapshot.orders, journals: snapshot.journals, reservations: snapshot.reservations, intents: snapshot.intents };
}
function webhook(snapshot: Snapshot, amount = snapshot.provider.amount, currency = "ZAR", id = snapshot.provider.id) {
  return JSON.stringify({ event: "charge.success", data: { id, domain: "test", status: "success", reference: snapshot.attempt.merchantReference, amount, currency } });
}
async function send(page: Page, raw: string, signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex")) {
  return page.request.post("/api/payments/paystack/webhook", { data: raw, headers: { "content-type": "application/json", "x-paystack-signature": signature } });
}

for (const guest of [false, true]) for (const width of [1440, 390]) {
  test(`${guest ? "verified guest" : "customer"} canonical Paystack receipt consumes inventory and finalizes exactly once at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const suffix = guest ? `guest-${width}` : String(width);
    const { reference, baseline } = await prepare(page, suffix, width, guest);
    const ownedCookies = await page.context().cookies();
    const raw = webhook(baseline);
    expect((await send(page, raw, "0".repeat(128))).status()).toBe(401);
    const changed = raw.replace('"currency":"ZAR"', '"currency":"USD"');
    const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex");
    expect((await send(page, changed, signature)).status()).toBe(401);
    expect((await control(reference)).events).toHaveLength(0);
    expect(protectedState(await control(reference))).toEqual(protectedState(baseline));
    await login(page, "e2e-checkout-other@ktcouriers.local");
    expect((await page.request.get(`/api/checkout/${reference}/status`)).status()).toBe(404);
    expect((await page.request.post(`/api/checkout/${reference}/prepare-payment`, { data: operation(1) })).status()).toBe(404);
    expect(protectedState(await control(reference))).toEqual(protectedState(baseline));
    if (guest) { await page.context().clearCookies(); await page.context().addCookies(ownedCookies); }
    else await login(page, `e2e-paystack-${width}@ktcouriers.local`);
    await control(reference, "success");
    const responses = await Promise.all([send(page, raw), send(page, raw), send(page, raw)]);
    for (const response of responses) expect(response.status(), await response.text()).toBe(200);
    const ingested = await control(reference);
    expect(ingested.events).toHaveLength(1);
    expect(ingested.events[0]).toMatchObject({ processingStatus: "RECEIVED", signatureVerified: true, providerDataVerified: false, amountVerified: false });
    expect(protectedState(ingested)).toEqual(protectedState(baseline));
    const completed = await control(reference, "process");
    expect(completed.payment).toMatchObject({ status: "SUCCEEDED", currency: "ZAR", amount: baseline.payment.amount });
    expect(completed.attempt.status).toBe("SUCCEEDED");
    expect(completed.provider.verifyCalls).toBeGreaterThan(0);
    expect(completed.events[0]).toMatchObject({ processingStatus: "APPLIED", signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true, attemptCount: 1 });
    expect(completed.journals).toHaveLength(1);
    const journal = completed.journals[0];
    expect(journal).toMatchObject({ currency: "ZAR", totalDebits: baseline.payment.amount, totalCredits: baseline.payment.amount });
    expect(journal.id).toBe(completed.payment.successLedgerJournalId);
    expect(journal.entries).toHaveLength(2);
    expect(journal.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "DEBIT", amount: baseline.payment.amount, account: { code: "PLATFORM-CASH-CLEARING-ZAR" } }),
      expect.objectContaining({ direction: "CREDIT", amount: baseline.payment.amount, account: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" } }),
    ]));
    expect(completed.orders).toHaveLength(1);
    expect(completed.orders[0]).toMatchObject({ paymentId: completed.payment.id, grandTotal: baseline.payment.amount, currency: "ZAR" });
    expect(completed.orders[0].guestCapabilityBound).toBe(guest);
    expect(completed.orders[0].storeOrders).toHaveLength(1);
    expect(completed.orders[0].storeOrders[0].lines).toHaveLength(1);
    expect(completed.orders[0].storeOrders[0].settlementSnapshots).toHaveLength(1);
    expect(completed.checkout.status).toBe("COMPLETED");
    expect(completed.reservations).toHaveLength(1); expect(completed.reservations[0].status).toBe("CONSUMED");
    for (const item of completed.reservations[0].items) {
      const before = baseline.reservations[0].items.find(value => value.inventoryLevel.id === item.inventoryLevel.id)!;
      expect(item.inventoryLevel.onHand).toBe(before.inventoryLevel.onHand - item.quantity);
      expect(item.inventoryLevel.reserved).toBe(before.inventoryLevel.reserved - item.quantity);
      expect(item.inventoryLevel.available).toBe(before.inventoryLevel.available);
      expect(item.inventoryLevel.onHand).toBe(item.inventoryLevel.available + item.inventoryLevel.reserved);
    }
    expect(completed.intents).toHaveLength(1); expect(completed.intents[0].deliveries).toHaveLength(1); expect(completed.intents[0].deliveries[0].status).toBe("COMPLETED");
    expect((await send(page, raw)).status()).toBe(200);
    const replayed = await control(reference, "process");
    expect(protectedState(replayed)).toEqual(protectedState(completed));
    await page.goto(`/checkout/paystack/return?payment=${completed.payment.reference}`);
    await expect(page.getByRole("heading", { name: "Payment confirmed", exact: true })).toBeVisible();
    await read(page, reference);
    const tracking = await page.request.get(`/api/marketplace-orders/${completed.orders[0].publicReference}/tracking`);
    expect(tracking.status(), await tracking.text()).toBe(200);
    expect(await tracking.text()).not.toContain("guestConfirmationHash");
    if (guest) {
      const orderCookie = (await page.context().cookies()).find(cookie => cookie.name === "kt_marketplace_order");
      expect(orderCookie?.httpOnly).toBe(true);
      expect(await page.evaluate(() => document.cookie.includes("kt_marketplace_order"))).toBe(false);
    }
    await page.context().clearCookies();
    expect((await page.request.get(`/api/marketplace-orders/${completed.orders[0].publicReference}/tracking`)).status()).toBe(401);
    await login(page, "e2e-checkout-other@ktcouriers.local");
    expect((await page.request.get(`/api/marketplace-orders/${completed.orders[0].publicReference}/tracking`)).status()).toBe(404);
    expect(protectedState(await control(reference))).toEqual(protectedState(completed));
    await testInfo.attach("canonical-postgres-payment-proof", { body: JSON.stringify({ baseline, completed, replayed }), contentType: "application/json" });
  });
}
for (const outcome of ["amount", "currency", "unknown", "reference"] as const) {
  test(`signed charge remains financially unchanged when independent Verify has ${outcome} mismatch`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const { reference, baseline } = await prepare(page, outcome, 390);
    await control(reference, outcome);
    expect((await send(page, webhook(baseline))).status()).toBe(200);
    const rejected = await control(reference, "process");
    expect(rejected.provider.verifyCalls).toBeGreaterThan(0);
    expect(rejected.events).toHaveLength(1); expect(rejected.events[0].processingStatus).toBe("RECONCILIATION_REQUIRED");
    expect(protectedState(rejected)).toEqual(protectedState(baseline));
    await testInfo.attach("canonical-postgres-negative-proof", { body: JSON.stringify({ baseline, rejected }), contentType: "application/json" });
  });
}
test("signed incorrect amounts and currency cannot override independent correct provider facts", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const { reference, baseline } = await prepare(page, "payload", 390);
  await control(reference, "success");
  expect((await send(page, webhook(baseline, baseline.provider.amount + 1))).status()).toBe(200);
  expect((await send(page, webhook(baseline, baseline.provider.amount, "USD", baseline.provider.id + 1))).status()).toBe(200);
  const rejected = await control(reference, "process");
  expect(rejected.events).toHaveLength(2);
  expect(rejected.events.every(event => event.processingStatus === "RECONCILIATION_REQUIRED")).toBe(true);
  expect(rejected.provider.verifyCalls).toBe(2);
  expect(protectedState(rejected)).toEqual(protectedState(baseline));
  await testInfo.attach("canonical-postgres-signed-mismatch-proof", { body: JSON.stringify({ baseline, rejected }), contentType: "application/json" });
});
