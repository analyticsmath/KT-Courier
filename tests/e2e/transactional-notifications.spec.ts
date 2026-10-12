import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { login } from "./fixtures/auth";
import { createPaidCheckout, storeAction, storeControl } from "./fixtures/store-order";
import { refundControl, assertBalancedRefundJournal } from "./fixtures/refund";
const execute = promisify(execFile);
type Receipt = { messages: Array<{ audience: string; eventType: string; receiptStatus: string; deliveries: Array<{ channel: string; status: string; eligibilityReason: string | null }>; inbox: { publicReference: string; state: string; title: string; body: string } | null }>; payment: { amount: string; reserved: string; refunded: string } };
async function control(action: string, reference = "") {
  const { stdout } = await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase3-notification-control.ts", action, reference], { env: process.env, timeout: 60_000, maxBuffer: 2_000_000 });
  if (action === "prepare") { expect(stdout).toContain("NOTIFICATION_PREPARED"); return null; }
  const line = stdout.split(/\r?\n/).find(s => s.startsWith("NOTIFICATION_SNAPSHOT "));
  if (!line) throw new Error("Missing real canonical notification receipt.");
  return JSON.parse(line.slice("NOTIFICATION_SNAPSHOT ".length)) as Receipt;
}
for (const width of [1440, 390]) test(`owned paid, store and refund inbox, preferences and revocation at ${width}px`, async ({ page }, info) => {
  test.setTimeout(240_000);
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Named disposable browser runner required.");
  await control("prepare"); const suffix = `wallet-${width === 1440 ? 301440 : 30390}`, email = `e2e-paystack-${suffix}@ktcouriers.local`;
  await page.setViewportSize({ width, height: 900 }); await login(page, email); await page.goto("/account/notifications");
  await expect(page.getByRole("heading", { name: "Account notifications", exact: true })).toBeVisible();
  const paymentPreference = page.getByRole("checkbox", { name: "payment status", exact: true }); await expect(paymentPreference).toBeChecked();
  const preferenceSaved = page.waitForResponse(r => r.url().endsWith("/api/notifications/preferences") && r.request().method() === "PATCH");
  await paymentPreference.uncheck(); expect((await preferenceSaved).status()).toBe(200); await expect(paymentPreference).not.toBeChecked();
  const paid = await createPaidCheckout(page, suffix, width);
  const f = { ...paid, storeReference: paid.snapshot.orders[0].storeOrders[0].publicReference };
  const initial = (await control("consume", f.reference))!;
  expect(initial.messages.filter(m => m.audience === "CUSTOMER").map(m => m.eventType).sort()).toEqual(["MARKETPLACE_ORDER_CONFIRMED", "PAYMENT_SUCCEEDED_VERIFIED"]);
  const paymentMessage = initial.messages.find(m => m.eventType === "PAYMENT_SUCCEEDED_VERIFIED")!;
  expect(paymentMessage.inbox).not.toBeNull(); expect(paymentMessage.deliveries.find(d => d.channel === "EMAIL")).toMatchObject({ status: "ELIGIBILITY_BLOCKED", eligibilityReason: "PREFERENCE_DISABLED" });
  expect(initial.messages.find(m => m.eventType === "STORE_ORDER_RECEIVED")).toMatchObject({ audience: "STORE", receiptStatus: "CONSUMED" });
  expect(await control("consume", f.reference)).toEqual(initial);
  await page.goto("/account/notifications");
  const item = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: paymentMessage.inbox!.title, exact: true }) });
  await expect(item).toContainText(paymentMessage.inbox!.body);
  const read = page.waitForResponse(r => r.url().endsWith(`/api/notifications/${paymentMessage.inbox!.publicReference}/read`));
  await item.getByRole("button", { name: "Mark read", exact: true }).focus(); await item.getByRole("button", { name: "Mark read", exact: true }).press("Enter"); expect((await read).status()).toBe(200);
  await expect(item.getByRole("button", { name: "Mark unread", exact: true })).toBeVisible();
  expect((await control("snapshot", f.reference))!.messages.find(m => m.eventType === "PAYMENT_SUCCEEDED_VERIFIED")!.inbox!.state).toBe("READ");
  await item.getByRole("button", { name: "Mark unread", exact: true }).click(); await expect(item.getByRole("button", { name: "Mark read", exact: true })).toBeVisible();
  await paymentPreference.check(); await expect(paymentPreference).toBeChecked();
  // Refund reservation precedes seller settlement so its captured funding is
  // still in the canonical source hold, then cancellation restores it exactly.
  const reserved = await refundControl(f.reference, "reserve-wallet", { amount: "25.00" });
  const cancelled = await refundControl(f.reference, "cancel", { reference: reserved.refunds[0].reference });
  assertBalancedRefundJournal(cancelled.refunds[0].reserve, "REFUND_RESERVE", "25.00"); assertBalancedRefundJournal(cancelled.refunds[0].release, "REFUND_RELEASE", "25.00");
  const baseline = await storeControl(f.storeReference, "initialize");
  const headers = { origin: new URL(page.url()).origin };
  await login(page, "e2e-checkout-other@ktcouriers.local");
  expect((await page.request.post(`/api/notifications/${paymentMessage.inbox!.publicReference}/read`, { headers })).status()).toBe(409);
  const foreign = await page.request.get("/api/notifications"); expect(foreign.status()).toBe(200); expect(await foreign.text()).not.toContain(paymentMessage.inbox!.publicReference);
  expect((await control("snapshot", f.reference))!.messages.find(m => m.eventType === "PAYMENT_SUCCEEDED_VERIFIED")!.inbox!.state).toBe("UNREAD");
  await login(page, "e2e-store@ktcouriers.local");
  await page.goto("/store/notifications"); await expect(page.getByText(initial.messages.find(m => m.eventType === "STORE_ORDER_RECEIVED")!.inbox!.body, { exact: true })).toBeVisible();
  for (const body of [{ action: "begin-review" }, { action: "confirm-availability", orderLineId: baseline.lines[0].id, availableQuantity: 1 }, { action: "accept", preparationMinutes: 30, pickupInstructions: "Disposable notification collection" }, { action: "start-preparation" }, { action: "mark-ready" }]) {
    const response = await storeAction(page, f.storeReference, body); expect(response.status(), await response.text()).toBe(200);
  }
  expect((await storeControl(f.storeReference)).payment).toEqual(baseline.payment);
  const final = (await control("consume", f.reference))!;
  expect(final.payment).toEqual(initial.payment); expect(final.messages.every(m => m.receiptStatus === "CONSUMED" && m.inbox)).toBe(true);
  expect(final.messages.filter(m => m.audience === "CUSTOMER").map(m => m.eventType)).toEqual(expect.arrayContaining(["STORE_ORDER_ACCEPTED", "STORE_ORDER_READY_FOR_HANDOFF", "COURIER_ORDER_BRIDGED", "REFUND_STATUS_CHANGED"]));
  const refunds = final.messages.filter(m => m.eventType === "REFUND_STATUS_CHANGED"); expect(refunds).toHaveLength(2);
  expect(refunds.some(m => m.inbox!.body.includes("cancelled"))).toBe(true); expect(refunds.every(m => m.deliveries.find(d => d.channel === "EMAIL")?.status === "QUEUED")).toBe(true);
  expect(await control("consume", f.reference)).toEqual(final);
  await login(page, email); await page.goto("/account/notifications");
  for (const m of final.messages.filter(m => m.audience === "CUSTOMER")) await expect(page.getByRole("listitem").filter({ hasText: m.inbox!.body })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await info.attach(`canonical-inbox-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`canonical-inbox-${width}.png`) }), contentType: "image/png" });
  await item.getByRole("button", { name: "Archive notification", exact: true }).click(); await expect(item).toHaveCount(0);
  expect((await page.request.post(`/api/notifications/${paymentMessage.inbox!.publicReference}/unread`, { headers })).status()).toBe(409);
  const archived = (await control("snapshot", f.reference))!; expect(archived.messages.find(m => m.eventType === "PAYMENT_SUCCEEDED_VERIFIED")!.inbox!.state).toBe("ARCHIVED");
  await page.context().clearCookies(); expect((await page.request.post(`/api/notifications/${paymentMessage.inbox!.publicReference}/read`, { headers })).status()).toBe(401);
  expect(await control("snapshot", f.reference)).toEqual(archived);
  await info.attach("canonical-notification-receipt", { body: JSON.stringify({ initial, final, archived, refund: cancelled }), contentType: "application/json" });
});
