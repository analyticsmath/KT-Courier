import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
async function read(page: Page, path: string) {
  const response = await page.request.get(path); expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store"); return response.json();
}
for (const width of [1440, 390]) {
  test(`finance inspects store evidence and retains refused reversal input at ${width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize({ width, height: 900 }); await login(page, `e2e-store-earning-finance-${width}@ktcouriers.local`);
    const owner = (await read(page, "/api/store/earnings")).data; expect(owner).toHaveLength(1);
    await login(page, "superadmin@ktcouriers.local"); const base = "/api/admin/store-earnings";
    const record = (await read(page, `${base}?pageSize=100`)).data.find((row: { publicReference: string }) => row.publicReference === owner[0].publicReference);
    expect(record).toMatchObject({ originalEarningAmount: "100.25", availablePayableAmount: "100.25", attributedCommissionAmount: "0.00", reconciliationRequired: true });
    const before = (await read(page, `${base}/${record.id}`)).earning;
    expect(before.journals.accrual).toBeTruthy(); expect(before.journals.release).toBeNull(); expect(before.journals.reversal).toBeNull();
    expect(before.refunds).toEqual([]); expect(before.commissionCharges).toEqual([]); expect(before.productionLock.active).toBe(true);
    await page.goto("/admin/store-earnings"); await expect(page.getByRole("heading", { name: "Store Earnings", exact: true })).toBeVisible();
    const table = page.getByRole("region", { name: "Store earnings records", exact: true });
    expect(await table.locator("td.is-numeric").count()).toBeGreaterThan(0);
    expect(await table.locator("td.is-numeric").evaluateAll(elements => elements.every(element => getComputedStyle(element).whiteSpace === "nowrap"))).toBe(true);
    if (width === 390) { await table.focus(); await table.press("ArrowRight"); await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const link = page.getByRole("link", { name: record.publicReference, exact: true }); await link.focus(); await link.press("Enter");
    await expect(page).toHaveURL(`/admin/store-earnings/${record.id}`); await expect(page.getByText(before.journals.accrual, { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Commission attribution", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "History and reconciliation", exact: true })).toBeVisible();
    await expect(page.getByLabel(/amount editor|account selector|mark released|create earning/i)).toHaveCount(0);
    const note = `Disposable reviewed note at ${width}px`;
    await page.getByRole("combobox", { name: "Approved reason", exact: true }).selectOption("AUTHORITATIVE_RECALCULATION");
    await page.getByRole("textbox", { name: "Safe note (optional)", exact: true }).fill(note);
    const responsePromise = page.waitForResponse(response => response.url().endsWith(`${base}/${record.id}/reverse`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Request exact reversal", exact: true }).click(); const response = await responsePromise; expect(response.status()).toBe(503);
    expect(response.request().postDataJSON()).toMatchObject({ reasonCode: "AUTHORITATIVE_RECALCULATION", safeNote: note, operationId: expect.stringMatching(/^store-earning-ui:/) });
    expect(response.request().postDataJSON()).not.toHaveProperty("amount"); expect(await response.json()).toMatchObject({ blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" });
    await expect(page.getByRole("status").filter({ hasText: "Store earning operations are inactive pending consolidated validation approval." })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Safe note (optional)", exact: true })).toHaveValue(note);
    await expect(page.getByRole("combobox", { name: "Approved reason", exact: true })).toHaveValue("AUTHORITATIVE_RECALCULATION");

    const reversePath = `**${base}/${record.id}/reverse`; await page.route(reversePath, route => route.abort("failed"));
    try {
      await page.getByRole("button", { name: "Request exact reversal", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Reversal request could not be sent. Check your connection and try again." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Request exact reversal", exact: true })).toBeEnabled();
      await expect(page.getByRole("textbox", { name: "Safe note (optional)", exact: true })).toHaveValue(note);
    } finally { await page.unroute(reversePath); }
    expect((await read(page, `${base}/${record.id}`)).earning).toEqual(before);
    const spoofed = await page.evaluate(async path => (await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID(), reasonCode: "SETTLEMENT_INVALIDATED", amount: "1.00", accountId: "forged" }) })).status, `${base}/${record.id}/reverse`);
    expect(spoofed).toBe(422); expect((await read(page, `${base}/${record.id}`)).earning).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const caseBase = "/api/admin/store-earning-reconciliation";
    const cases = (await read(page, `${caseBase}?pageSize=100`)).data.filter((row: { earningReference: string }) => row.earningReference === record.publicReference);
    expect(cases).toHaveLength(1); const reference = cases[0].publicReference; const caseBefore = (await read(page, `${caseBase}/${reference}`)).reconciliation;
    await page.goto("/admin/store-earning-reconciliation"); const caseTable = page.getByRole("region", { name: "Store earning reconciliation records", exact: true });
    if (width === 390) { await caseTable.focus(); await caseTable.press("ArrowRight"); await expect.poll(() => caseTable.evaluate(element => element.scrollLeft)).toBeGreaterThan(0); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const caseLink = page.getByRole("link", { name: reference, exact: true }); await caseLink.focus(); await caseLink.press("Enter");
    await expect(page).toHaveURL(`/admin/store-earning-reconciliation/${reference}`); await expect(page.getByText(caseBefore.safeSummary, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /resolve|mark resolved|close case|rebuild/i })).toHaveCount(0);
    await expect(page.getByText("PRIVATE_INTERNAL_STORE_FINANCE_EVIDENCE", { exact: false })).toHaveCount(0);
    expect((await read(page, `${caseBase}/${reference}`)).reconciliation).toEqual(caseBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const released = (await read(page, `${base}?status=RELEASED&pageSize=100`)).data[0]; expect(released).toBeTruthy();
    await page.goto(`/admin/store-earnings/${released.id}`); await expect(page.getByRole("form", { name: "Store earning reversal", exact: true })).toHaveCount(0);
  });
}
test("store finance denies wrong roles, explicit DENY and anonymous access", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  await login(page, "superadmin@ktcouriers.local"); const record = (await read(page, "/api/admin/store-earnings")).data[0];
  const reference = (await read(page, "/api/admin/store-earning-reconciliation")).data[0].publicReference;
  const paths = ["/api/admin/store-earnings", `/api/admin/store-earnings/${record.id}`, "/api/admin/store-earning-reconciliation", `/api/admin/store-earning-reconciliation/${reference}`];
  for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local", "e2e-earning-other@ktcouriers.local", "e2e-ledger-denied@ktcouriers.local"]) {
    await login(page, email); for (const path of paths) expect((await page.request.get(path)).status()).toBe(403);
    expect((await page.request.post(`/api/admin/store-earnings/${record.id}/reverse`, { data: { operationId: crypto.randomUUID(), reasonCode: "SETTLEMENT_INVALIDATED" } })).status()).toBe(403);
  }
  await page.context().clearCookies(); for (const path of paths) expect((await page.request.get(path)).status()).toBe(401);
  expect((await page.request.post(`/api/admin/store-earnings/${record.id}/reverse`, { data: {} })).status()).toBe(401);
});
