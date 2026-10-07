import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

async function read(page: Page, path: string) {
  const response = await page.request.get(path); expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return response.json();
}
function assertSafeOwnerRecord(row: Record<string, unknown>) {
  for (const field of ["id", "driverId", "walletId", "payableAccountId", "paymentId", "paymentPublicReference", "customer", "journals", "commissionCharges", "safeMetadata", "latitude", "proofOfDelivery"]) expect(row).not.toHaveProperty(field);
  expect(JSON.stringify(row)).not.toMatch(/PRIVATE_CUSTOMER|PRIVATE_RECIPIENT|PRIVATE_POD/);
}
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`driver reads exact accrual/release history and rejects foreign earnings at ${viewport.width}px`, async ({ page }, testInfo) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    await login(page, "e2e-earning-other@ktcouriers.local");
    const foreign = (await read(page, "/api/driver/earnings")).data[0].publicReference;
    await login(page, `e2e-earning-${viewport.width}@ktcouriers.local`);
    const before = await read(page, "/api/driver/earnings"); expect(before.data).toHaveLength(2);
    before.data.forEach(assertSafeOwnerRecord);
    const accrued = before.data.find((row: { status: string }) => row.status === "ACCRUED");
    const released = before.data.find((row: { status: string }) => row.status === "RELEASED");
    expect(accrued).toMatchObject({ originalEarningAmount: "100.25", availablePayableAmount: "100.25", refundReservedAmount: "0.00", releasedAmount: "0.00", currency: "ZAR" });
    expect(released).toMatchObject({ originalEarningAmount: "25.40", availablePayableAmount: "0.00", releasedAmount: "25.40", currency: "ZAR" });
    expect((await read(page, "/api/driver/earnings/summary")).summary).toMatchObject({ payableBalance: "100.25", refundReserved: "0.00", releasedToOwnerWithdrawable: "25.40", releaseEligible: "100.25" });
    await page.goto("/driver/earnings");
    await expect(page.getByRole("heading", { name: "Earnings", exact: true })).toBeVisible();
    const summary = page.locator('[aria-label="Driver earnings summary"]');
    for (const amount of ["ZAR 100.25", "ZAR 25.40", "ZAR 0.00"]) await expect(summary.getByText(amount, { exact: true })).toBeVisible();
    const link = page.getByRole("link", { name: new RegExp(accrued.publicReference) });
    await link.focus(); await link.press("Enter");
    await expect(page).toHaveURL(`/driver/earnings/${accrued.publicReference}`);
    await expect(page.getByRole("heading", { name: accrued.publicReference, exact: true })).toBeVisible();
    await expect(page.getByText("ACCRUAL_POSTED", { exact: false })).toBeVisible();
    const detail = (await read(page, `/api/driver/earnings/${accrued.publicReference}`)).earning; assertSafeOwnerRecord(detail);
    expect(detail.history.map((event: { reasonCode: string }) => event.reasonCode)).toEqual(["ACCRUAL_POSTED", "COMMISSION_CHARGES_ATTRIBUTED"]);
    await page.goto(`/driver/earnings/${released.publicReference}`);
    await expect(page.getByText("RELEASE_COMPLETED", { exact: false })).toBeVisible();
    for (const role of ["button", "link"] as const) await expect(page.getByRole(role, { name: /^(release|payout|reverse|withdraw|edit balance|create earning)$/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("driver-released-earning.png"), fullPage: true, animations: "disabled" });
    const denied = await page.request.get(`/api/driver/earnings/${foreign}`);
    const missing = await page.request.get("/api/driver/earnings/DE-00000000000000000000000000000000");
    expect(denied.status()).toBe(404); expect(missing.status()).toBe(404); expect(await denied.json()).toEqual(await missing.json());
    expect((await page.request.get(`/api/driver/earnings?driverReference=${foreign}`)).status()).toBe(422);
    await page.goto(`/driver/earnings/${foreign}`); await expect(page.getByRole("heading", { name: "That route is not on this map.", exact: true })).toBeVisible();
    expect(await read(page, "/api/driver/earnings")).toEqual(before);
  });
}
test("driver financial reads deny inactive eligibility, wrong roles and anonymous requests", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  const paths = ["/api/driver/earnings", "/api/driver/earnings/summary", "/api/driver/earnings/DE-00000000000000000000000000000000"];
  for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local", "superadmin@ktcouriers.local", "e2e-onboarding-1440@ktcouriers.local"]) {
    await login(page, email);
    for (const path of paths) { const response = await page.request.get(path); expect(response.status()).toBe(403); expect(await response.json()).not.toHaveProperty("data"); }
  }
  await page.context().clearCookies();
  for (const path of paths) expect((await page.request.get(path)).status()).toBe(401);
});
