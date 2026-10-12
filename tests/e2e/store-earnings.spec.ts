import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
async function read(page: Page, path: string) {
  const response = await page.request.get(path); expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store"); return response.json();
}
for (const width of [1440, 390]) {
  test(`store owner inspects exact accrued/released evidence and denies foreign records at ${width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize({ width, height: 900 }); await login(page, "e2e-store-earning-other@ktcouriers.local");
    const foreign = (await read(page, "/api/store/earnings")).data[0].publicReference;
    await login(page, `e2e-store-earning-${width}@ktcouriers.local`);
    const rows = (await read(page, "/api/store/earnings")).data; expect(rows).toHaveLength(2);
    const accrued = rows.find((row: { status: string }) => row.status === "ACCRUED");
    const released = rows.find((row: { status: string }) => row.status === "RELEASED");
    expect(accrued).toMatchObject({ originalEarningAmount: "100.25", availablePayableAmount: "100.25", releasedAmount: "0.00", refundReservedAmount: "0.00" });
    expect(released).toMatchObject({ originalEarningAmount: "25.40", availablePayableAmount: "0.00", releasedAmount: "25.40" });
    expect((await read(page, "/api/store/earnings/summary")).summary).toMatchObject({ totalAccrued: "125.65", payableBalance: "100.25", releasedToWithdrawable: "25.40", refundReserved: "0.00" });
    for (const row of rows) for (const key of ["id", "storeId", "walletId", "payableAccountId", "customerId", "paymentId"]) expect(row).not.toHaveProperty(key);
    await page.goto("/store/earnings"); await expect(page.getByRole("heading", { name: "Earnings", exact: true })).toBeVisible();
    await expect(page.getByText("ZAR 100.25", { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const link = page.getByRole("link", { name: released.publicReference, exact: true }); await link.focus(); await link.press("Enter");
    await expect(page).toHaveURL(`/store/earnings/${released.publicReference}`);
    const detail = (await read(page, `/api/store/earnings/${released.publicReference}`)).earning;
    expect(detail.releaseJournalReference).toBeTruthy(); expect(detail.history.map((event: { reasonCode: string }) => event.reasonCode)).toContain("RELEASE_COMPLETED");
    expect(detail).toMatchObject({ productionLock: { active: true, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" } });
    await expect(page.getByRole("heading", { name: "Earning record", exact: true })).toBeVisible();
    await expect(page.getByText("ZAR 25.40", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /reverse|adjust|create earning|mark released/i })).toHaveCount(0);
    await expect(page.getByLabel(/amount editor|account selector/i)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const missing = "SE-00000000000000000000000000000000";
    const denied = await page.request.get(`/api/store/earnings/${foreign}`); const absent = await page.request.get(`/api/store/earnings/${missing}`);
    expect(denied.status()).toBe(404); expect(absent.status()).toBe(404); expect(await denied.json()).toEqual(await absent.json());
    expect((await page.goto(`/store/earnings/${foreign}`))!.status()).toBe(404);
    expect((await read(page, `/api/store/earnings/${released.publicReference}`)).earning).toEqual(detail);
  });
}
test("store earning endpoints deny accounts without business finance access and anonymous requests", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  await login(page, "e2e-store-earning-other@ktcouriers.local"); const reference = (await read(page, "/api/store/earnings")).data[0].publicReference;
  const paths = ["/api/store/earnings", "/api/store/earnings/summary", `/api/store/earnings/${reference}`];
  for (const email of ["customer@ktcouriers.local", "e2e-earning-other@ktcouriers.local", "superadmin@ktcouriers.local"]) {
    await login(page, email); for (const path of paths) expect((await page.request.get(path)).status()).toBe(403);
  }
  await page.context().clearCookies(); for (const path of paths) expect((await page.request.get(path)).status()).toBe(401);
});
