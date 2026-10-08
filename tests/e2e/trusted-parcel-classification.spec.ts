import { test, expect, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { login } from "./fixtures/auth";
import type { TrustedPackageVersion } from "../../lib/marketplace-checkout/parcel-classification";
const execute = promisify(execFile);
type Fixture = { storeId: string; makerId: string; reviewerId: string; makerEmail: string; reviewerEmail: string; email: string; entries: TrustedPackageVersion["packages"]; packageStartingVersion: number };
type Snapshot = { classification: { status: string; sizeClass: string | null; reason: string; packageVersion: number | null; profileVersion: number | null }; checkout: { status: string; version: number }; quotes: Array<{ subtotal: string; taxAmount: string; total: string; ruleSnapshot: { ruleKey: string; parcelClassification: { sizeClass: string | null; reason: string; packageVersion: number | null } } }>; stock: Array<{ onHand: number; reserved: number; available: number }>; paymentCount: number; orderCount: number; audit: Array<{ action: string; actorUserId: string; metadata: { afterStatus?: string } }> };
async function control<T>(action: string, tag: string, reference = ""): Promise<T> {
  const { stdout } = await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase3-parcel-control.ts", action, tag, reference], { env: process.env, timeout: 60_000, maxBuffer: 2_000_000 });
  const line = stdout.split(/\r?\n/).find(value => value.startsWith("PARCEL_RECEIPT "));
  if (!line) throw new Error("Named PostgreSQL parcel receipt was not produced.");
  return JSON.parse(line.slice("PARCEL_RECEIPT ".length));
}
async function versions(page: Page) {
  const response = await page.request.get("/api/admin/marketplace-trusted-packages"); expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store"); return await response.json() as Array<TrustedPackageVersion & { updatedAt: string }>;
}
async function freshCheckout(page: Page, f: Fixture, entry: Fixture["entries"][number], quantity = 1) {
  await login(page, f.email);
  const cartResponse = await page.request.get("/api/cart"); expect(cartResponse.status()).toBe(200);
  const cart = (await cartResponse.json()).cart;
  const added = await page.request.post("/api/cart/lines", { data: { offerReference: entry.offerReference, variantReference: entry.variantReference, quantity, modifiers: [], operationId: randomUUID(), requestHash: randomUUID(), cartVersion: cart.version } }); expect(added.status(), await added.text()).toBe(201);
  const created = await page.request.post("/api/checkout", { data: { cartReference: (await added.json()).cart.reference } }); expect(created.status(), await created.text()).toBe(201);
  const reference = (await created.json()).checkout.reference as string;
  await page.goto(`/checkout?ref=${reference}`);
  await page.getByLabel("Recipient Full Name", { exact: true }).fill("Disposable measured parcel customer");
  await page.getByLabel("Email Address", { exact: true }).fill(f.email); await page.getByLabel("Phone Number (SA)", { exact: true }).fill("+27821112233");
  await page.getByRole("button", { name: /Continue to Delivery Address/ }).click(); await expect(page.getByRole("heading", { name: "2. Delivery address", exact: true })).toBeFocused();
  await page.getByLabel("Street Address (Line 1)", { exact: true }).fill("45 Commission St"); await page.getByLabel("Suburb / Area", { exact: true }).fill("Central"); await page.getByLabel("City", { exact: true }).fill("Johannesburg"); await page.getByLabel("Province", { exact: true }).selectOption("Gauteng"); await page.getByLabel("Postal Code", { exact: true }).fill("2001");
  return reference;
}
async function calculate(page: Page, reference: string) {
  const pending = page.waitForResponse(response => response.url().endsWith(`/api/checkout/${reference}/delivery-quotes`) && response.request().method() === "POST");
  await page.getByRole("button", { name: /Calculate Delivery/ }).click(); return pending;
}
async function review(page: Page, reference: string) {
  await expect(page.getByRole("heading", { name: "3. Delivery options", exact: true })).toBeFocused();
  const pending = page.waitForResponse(response => response.url().endsWith(`/api/checkout/${reference}/review`) && response.request().method() === "POST");
  await page.getByRole("button", { name: /Review order/ }).click(); const response = await pending; expect(response.status(), await response.text()).toBe(200);
  expect((await response.json()).status).toBe("READY_FOR_REVIEW"); await expect(page.getByRole("heading", { name: "4. Review your order", exact: true })).toBeFocused();
}
for (const width of [1440, 390]) test(`independent measured packaging governance and canonical quotes at ${width}px`, async ({ page }, info) => {
  test.setTimeout(300_000);
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Named offline browser runtime required.");
  const tag = `parcel-${width}-${randomUUID().slice(0, 8)}`;
  const f = await control<Fixture>("setup", tag);
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  try {
    await control("tariff-size", tag); await login(page, f.makerEmail); await page.goto("/admin/marketplace-delivery-policy");
    await expect(page.getByRole("heading", { name: "Trusted measured packaging", exact: true })).toBeVisible();
    const entry = f.entries[0];
    for (const [label, value] of [["Packaging store ID", entry.storeId], ["Packaging offer reference", entry.offerReference], ["Packaging variant reference", entry.variantReference], ["Packaging publication version", entry.publicationVersion], ["Measurement authority reference", entry.authorityReference], ["Packaging audit reason", "Disposable UI measured package; no production approval."], ["Packaged length (cm)", String(entry.lengthCm)], ["Packaged width (cm)", String(entry.widthCm)], ["Packaged height (cm)", String(entry.heightCm)], ["Packaged weight (kg)", String(entry.weightKg)], ["Packaging effective from", "2026-01-01T00:00"]]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Save packaging draft", exact: true }).focus();
    const saved = page.waitForResponse(response => response.url().endsWith("/api/admin/marketplace-trusted-packages") && response.request().method() === "POST");
    await page.keyboard.press("Enter"); expect((await saved).status()).toBe(201);
    await expect(page.getByRole("status").filter({ hasText: "Trusted package version and audit history saved." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const first = (await versions(page)).find(version => version.createdByUserId === f.makerId)!;
    expect(first).toMatchObject({ status: "DRAFT", approvedByUserId: null, packages: [entry] });
    const headers = { origin: new URL(page.url()).origin };
    const self = await page.request.patch("/api/admin/marketplace-trusted-packages", { headers, data: { version: first.version, expectedUpdatedAt: first.updatedAt, action: "APPROVE", reason: "Disposable prohibited maker self review." } }); expect(self.status()).toBe(403);
    expect((await versions(page)).find(v => v.version === first.version)).toEqual(first);
    const draft = { expectedVersion: first.version, effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, reason: "Disposable measured complete package snapshot.", packages: f.entries };
    const foreign = await page.request.post("/api/admin/marketplace-trusted-packages", { headers, data: { ...draft, packages: [{ ...entry, storeId: "foreign-store" }] } }); expect(foreign.status()).toBe(422);
    const valid = await page.request.post("/api/admin/marketplace-trusted-packages", { headers, data: draft }); expect(valid.status(), await valid.text()).toBe(201); const full = await valid.json() as TrustedPackageVersion;
    expect((await page.request.post("/api/admin/marketplace-trusted-packages", { headers, data: draft })).status()).toBe(409);
    let current = (await versions(page)).find(v => v.version === full.version)!;
    expect((await page.request.patch("/api/admin/marketplace-trusted-packages", { headers, data: { version: current.version, expectedUpdatedAt: current.updatedAt, action: "ACTIVATE", reason: "Disposable unapproved activation must fail." } })).status()).toBe(409);
    await login(page, f.reviewerEmail);
    const action = { version: current.version, expectedUpdatedAt: current.updatedAt, action: "APPROVE", reason: "Independent synthetic measured package review." };
    expect((await page.request.patch("/api/admin/marketplace-trusted-packages", { headers, data: action })).status()).toBe(200);
    expect((await page.request.patch("/api/admin/marketplace-trusted-packages", { headers, data: { ...action, action: "ACTIVATE" } })).status()).toBe(409);
    current = (await versions(page)).find(v => v.version === full.version)!;
    expect((await page.request.patch("/api/admin/marketplace-trusted-packages", { headers, data: { ...action, action: "ACTIVATE", expectedUpdatedAt: current.updatedAt } })).status()).toBe(200);
    expect((await versions(page)).find(v => v.version === full.version)).toMatchObject({ status: "ACTIVE", createdByUserId: f.makerId, approvedByUserId: f.reviewerId });
    const receipts: Snapshot[] = [];
    for (const [suffix, sizeClass, fee] of [["small", "SMALL", "11.00"], ["medium", "MEDIUM", "22.00"], ["large", "LARGE", "33.00"]]) {
      const reference = await freshCheckout(page, f, f.entries.find(e => e.offerReference.endsWith(`-${suffix}`))!);
      const quote = await calculate(page, reference); expect(quote.status(), await quote.text()).toBe(200); await review(page, reference);
      const receipt = await control<Snapshot>("snapshot", tag, reference); receipts.push(receipt);
      expect(receipt.classification).toMatchObject({ status: "CLASSIFIED", sizeClass, packageVersion: full.version, reason: "REVIEWED_SINGLE_PREPACKAGED_UNIT" });
      expect(receipt.quotes).toHaveLength(1); expect(receipt.quotes[0]).toMatchObject({ subtotal: fee, ruleSnapshot: { ruleKey: `PARCEL_${sizeClass}`, parcelClassification: { sizeClass, packageVersion: full.version } } });
      expect(receipt.paymentCount).toBe(0); expect(receipt.orderCount).toBe(0); expect(receipt.stock.every(row => row.onHand === 20 && row.reserved === 0 && row.available === 20)).toBe(true);
    }
    const unknown = await freshCheckout(page, f, entry, 2); const unknownDenied = await calculate(page, unknown); expect(unknownDenied.status(), await unknownDenied.text()).toBe(422); expect((await unknownDenied.json()).code).toBe("CHECKOUT_REVIEW_REQUIRED"); await expect(page.locator("#checkout-error")).toContainText("No approved marketplace delivery tariff");
    const unknownBefore = await control<Snapshot>("snapshot", tag, unknown); expect(unknownBefore.classification).toMatchObject({ status: "UNKNOWN", sizeClass: null, reason: "AGGREGATE_PACKING_APPROVAL_REQUIRED" }); expect(unknownBefore.quotes).toHaveLength(0);
    await control("tariff-any", tag); const anyQuote = await calculate(page, unknown); expect(anyQuote.status(), await anyQuote.text()).toBe(200); await review(page, unknown);
    const anyReceipt = await control<Snapshot>("snapshot", tag, unknown); expect(anyReceipt.quotes[0]).toMatchObject({ subtotal: "44.00", ruleSnapshot: { ruleKey: "PARCEL_ANY", parcelClassification: { sizeClass: null } } }); expect(anyReceipt.stock).toEqual(unknownBefore.stock); receipts.push(anyReceipt);
    for (const suffix of ["oversize", "overweight"]) {
      const reference = await freshCheckout(page, f, f.entries.find(e => e.offerReference.endsWith(`-${suffix}`))!); const denied = await calculate(page, reference); expect(denied.status(), await denied.text()).toBe(422); expect((await denied.json()).code).toBe("CHECKOUT_REVIEW_REQUIRED"); await expect(page.locator("#checkout-error")).toContainText("exceed approved acceptance limits");
      const receipt = await control<Snapshot>("snapshot", tag, reference); expect(receipt.classification).toMatchObject({ status: "UNSUPPORTED", sizeClass: null }); expect(receipt.quotes).toHaveLength(0); expect(receipt.paymentCount).toBe(0); expect(receipt.orderCount).toBe(0); receipts.push(receipt);
    }
    await control("tariff-size", tag);
    const stale = await freshCheckout(page, f, f.entries.find(e => e.offerReference.endsWith("-stale"))!); await control("stale-offer", tag);
    const staleDenied = await calculate(page, stale); expect(staleDenied.status(), await staleDenied.text()).toBe(422); expect((await staleDenied.json()).code).toBe("CHECKOUT_REVIEW_REQUIRED"); const staleReceipt = await control<Snapshot>("snapshot", tag, stale); expect(staleReceipt.classification).toMatchObject({ status: "UNKNOWN", reason: "PACKAGE_SOURCE_REVISION_STALE" }); expect(staleReceipt.quotes).toHaveLength(0); receipts.push(staleReceipt);
    await login(page, f.email); expect((await page.request.get("/api/admin/marketplace-trusted-packages")).status()).toBe(403);
    expect((await page.request.post("/api/admin/marketplace-trusted-packages", { headers, data: draft })).status()).toBe(403);
    expect(receipts[0].audit.filter(row => row.metadata.afterStatus === "APPROVED")).toEqual([expect.objectContaining({ actorUserId: f.reviewerId })]);
    await info.attach(`trusted-parcel-postgres-${width}`, { body: JSON.stringify(receipts), contentType: "application/json" });
    await login(page, f.reviewerEmail); await page.goto("/admin/marketplace-delivery-policy"); await info.attach(`trusted-parcel-admin-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  } finally { await control("cleanup", tag); }
});
