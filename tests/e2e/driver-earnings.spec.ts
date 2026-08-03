import { test, expect } from "@playwright/test";
test.describe.skip("driver earning flow", () => {
  test("shows exact safe earnings evidence without mutation or payout controls", async ({ page }) => { await page.goto("/driver/earnings"); await expect(page.getByRole("heading", { name: "Earnings", exact: true })).toBeVisible(); await expect(page.getByText("Payable balance")).toBeVisible(); await expect(page.getByText("Refund reserved")).toBeVisible(); await expect(page.getByRole("button", { name: /release|payout|reverse/i })).toHaveCount(0); await expect(page.locator("body")).not.toContainText(/customer email|customer address|gps|proof image/i); });
  test("denies another driver's earning detail", async ({ page }) => { await page.goto("/driver/earnings/DE-00000000000000000000000000000000"); await expect(page).not.toHaveURL(/another-driver/); });
});
