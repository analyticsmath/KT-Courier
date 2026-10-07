import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

async function read(page: Page, path: string) {
  const response = await page.request.get(path); expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return response.json();
}
for (const width of [1440, 390]) {
  test(`finance inspects canonical driver evidence and reversal stays locked at ${width}px`, async ({ page }, testInfo) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize({ width, height: 900 });
    await login(page, `e2e-earning-finance-${width}@ktcouriers.local`);
    const owner = (await read(page, "/api/driver/earnings")).data;
    expect(owner).toHaveLength(1); expect(owner[0].status).toBe("RECONCILIATION_REQUIRED");
    await login(page, "superadmin@ktcouriers.local");
    const base = "/api/admin/driver-earnings";
    const list = await read(page, `${base}?pageSize=100`);
    const record = list.data.find((row: { publicReference: string }) => row.publicReference === owner[0].publicReference);
    expect(record).toMatchObject({ originalEarningAmount: "100.25", availablePayableAmount: "100.25", attributedCommissionAmount: "0.00", reconciliationRequired: true });
    const before = (await read(page, `${base}/${record.id}`)).earning;
    expect(before.journals.accrual).toBeTruthy(); expect(before.journals.release).toBeNull(); expect(before.journals.reversal).toBeNull();
    expect(before.history.map((event: { reasonCode: string }) => event.reasonCode)).toEqual(["ACCRUAL_POSTED", "COMMISSION_CHARGES_ATTRIBUTED", "APPLICATION_FAILURE"]);
    await page.goto("/admin/driver-earnings");
    await expect(page.getByRole("heading", { name: "Driver Earnings", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    const table = page.getByRole("region", { name: "Driver earnings records", exact: true });
    const amounts = table.locator("td.is-numeric");
    expect(await amounts.count()).toBeGreaterThan(0);
    expect(await amounts.evaluateAll(elements => elements.every(element => getComputedStyle(element).whiteSpace === "nowrap"))).toBe(true);
    if (width === 390) {
      await table.focus(); await table.press("ArrowRight");
      await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    }
    await page.screenshot({ path: testInfo.outputPath("driver-finance-earnings-list.png"), fullPage: true, animations: "disabled" });
    const link = page.getByRole("link", { name: record.publicReference, exact: true });
    await link.focus(); await link.press("Enter"); await expect(page).toHaveURL(`/admin/driver-earnings/${record.id}`);
    await expect(page.getByText(before.journals.accrual, { exact: false })).toBeVisible();
    await expect(page.getByText("APPLICATION_FAILURE", { exact: false }).first()).toBeVisible();
    await expect(page.getByLabel(/amount editor|account selector|mark released|create earning/i)).toHaveCount(0);
    await page.getByRole("combobox", { name: "Approved reason", exact: true }).selectOption("OTHER_REVIEWED");
    await page.getByRole("textbox", { name: "Opaque evidence reference", exact: true }).fill(`fixture:driver-finance-review-${width}`);
    const reversalResponse = page.waitForResponse(response => response.url().endsWith(`${base}/${record.id}/reverse`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Request exact reversal", exact: true }).click();
    const refused = await reversalResponse; expect(refused.status()).toBe(503);
    expect(await refused.json()).toMatchObject({ blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" });
    await expect(page.getByRole("status").filter({ hasText: "Driver earning operations are inactive pending consolidated validation approval." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Request exact reversal", exact: true })).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "Approved reason", exact: true })).toHaveValue("OTHER_REVIEWED");
    await expect(page.getByRole("textbox", { name: "Opaque evidence reference", exact: true })).toHaveValue(`fixture:driver-finance-review-${width}`);
    await page.screenshot({ path: testInfo.outputPath("driver-finance-locked-reversal.png"), fullPage: true, animations: "disabled" });
    const reversePath = `**${base}/${record.id}/reverse`;
    await page.route(reversePath, route => route.abort("failed"));
    try {
      await page.getByRole("button", { name: "Request exact reversal", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Reversal request could not be sent. Check your connection and try again." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Request exact reversal", exact: true })).toBeEnabled();
      await expect(page.getByRole("textbox", { name: "Opaque evidence reference", exact: true })).toHaveValue(`fixture:driver-finance-review-${width}`);
    } finally {
      await page.unroute(reversePath);
    }
    expect((await read(page, `${base}/${record.id}`)).earning).toEqual(before);
    const spoofed = await page.evaluate(async ({ path }) => {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID(), reasonCode: "OTHER_REVIEWED", reversalEvidenceReference: "fixture:forged-reversal", amount: "1.00", accountId: "forged" }) });
      return response.status;
    }, { path: `${base}/${record.id}/reverse` }); expect(spoofed).toBe(422);
    expect((await read(page, `${base}/${record.id}`)).earning).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("driver-finance-network-failure.png"), fullPage: true, animations: "disabled" });
    const caseBase = "/api/admin/driver-earning-reconciliation";
    const cases = (await read(page, `${caseBase}?pageSize=100`)).data.filter((row: { earningReference: string }) => row.earningReference === record.publicReference);
    expect(cases).toHaveLength(1); const reference = cases[0].publicReference;
    const caseBefore = (await read(page, `${caseBase}/${reference}`)).reconciliation;
    await page.goto("/admin/driver-earning-reconciliation");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    const caseTable = page.getByRole("region", { name: "Driver earning reconciliation records", exact: true });
    if (width === 390) {
      await caseTable.focus(); await caseTable.press("ArrowRight");
      await expect.poll(() => caseTable.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    }
    await page.screenshot({ path: testInfo.outputPath("driver-finance-reconciliation-list.png"), fullPage: true, animations: "disabled" });
    const caseLink = page.getByRole("link", { name: reference, exact: true }); await caseLink.focus(); await caseLink.press("Enter");
    await expect(page).toHaveURL(`/admin/driver-earning-reconciliation/${reference}`);
    await expect(page.getByText(caseBefore.safeSummary, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /resolve|mark resolved|close case|rebuild/i })).toHaveCount(0);
    await expect(page.getByText("PRIVATE_INTERNAL_DRIVER_FINANCE_EVIDENCE", { exact: false })).toHaveCount(0);
    expect((await read(page, `${caseBase}/${reference}`)).reconciliation).toEqual(caseBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("driver-finance-reconciliation.png"), fullPage: true, animations: "disabled" });
  });
}
test("driver finance endpoints deny wrong roles, explicit DENY and anonymous access", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  await login(page, "superadmin@ktcouriers.local");
  const record = (await read(page, "/api/admin/driver-earnings")).data[0];
  const reference = (await read(page, "/api/admin/driver-earning-reconciliation")).data[0].publicReference;
  const paths = ["/api/admin/driver-earnings", `/api/admin/driver-earnings/${record.id}`, "/api/admin/driver-earning-reconciliation", `/api/admin/driver-earning-reconciliation/${reference}`];
  for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local", "e2e-earning-other@ktcouriers.local", "e2e-ledger-denied@ktcouriers.local"]) {
    await login(page, email);
    for (const path of paths) { const response = await page.request.get(path); expect(response.status()).toBe(403); expect(await response.json()).not.toHaveProperty("earning"); }
    expect((await page.request.post(`/api/admin/driver-earnings/${record.id}/reverse`, { data: { operationId: crypto.randomUUID(), reasonCode: "OTHER_REVIEWED", reversalEvidenceReference: "fixture:denied-reversal" } })).status()).toBe(403);
  }
  await page.context().clearCookies();
  for (const path of paths) expect((await page.request.get(path)).status()).toBe(401);
  expect((await page.request.post(`/api/admin/driver-earnings/${record.id}/reverse`, { data: {} })).status()).toBe(401);
});
