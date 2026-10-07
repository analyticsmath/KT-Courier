import { expect, test } from "@playwright/test";

test("keyboard variant navigation changes the canonical price without mutating the cart", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  const before = await page.request.get("/api/cart"); expect(before.status()).toBe(200);
  const cart = (await before.json()).cart; expect(cart.storeGroups).toHaveLength(0);
  await page.goto("/shop/products/e2e-smartphone-CP-E2ESMARTPHONE");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Smartphone 64GB");
  const option = page.locator('a[href*="CV-E2E128GB"]');
  await expect(option).toHaveCount(1); await option.focus(); await option.press("Enter");
  await expect(page).toHaveURL(/CV-E2E128GB/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Smartphone 128GB");
  await expect(page.getByRole("region", { name: "Purchase product" })).toContainText(/2\s*000/);
  await page.reload(); await expect(page).toHaveURL(/CV-E2E128GB/);
  await expect(page.getByRole("region", { name: "Purchase product" })).toContainText(/2\s*000/);
  const after = await page.request.get("/api/cart"); expect(after.status()).toBe(200);
  expect((await after.json()).cart).toEqual(cart);
});
