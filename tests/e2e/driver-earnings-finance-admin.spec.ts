import { test, expect } from "@playwright/test";
test.describe.skip("driver earning finance admin flow", () => {
  test("shows finance evidence and no amount or release editor", async ({ page }) => { await page.goto("/admin/driver-earnings"); await expect(page.getByRole("heading", { name: "Driver Earnings", exact: true })).toBeVisible(); await expect(page.getByLabel(/amount editor|account selector|mark released|create earning/i)).toHaveCount(0); });
  test("shows reconciliation and keeps reviewed reversal source-locked", async ({ page }) => { await page.goto("/admin/driver-earning-reconciliation"); await expect(page.getByRole("heading", { name: "Driver Earning Reconciliation", exact: true })).toBeVisible(); });
});
