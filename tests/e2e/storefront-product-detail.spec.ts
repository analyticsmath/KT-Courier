import { expect, test } from "@playwright/test";

test("keyboard variant navigation changes the canonical price without mutating the cart", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  const before = await page.request.get("/api/cart"); expect(before.status()).toBe(200);
  const cart = (await before.json()).cart; expect(cart.storeGroups).toHaveLength(0);
  await page.goto("/shop/products/e2e-smartphone-CP-E2ESMARTPHONE");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Smartphone 64GB");
  const chooser = page.getByRole("region", { name: "Purchase product", exact: true }).getByRole("group", { name: "Available product variants", exact: true });
  await expect(chooser).toHaveCount(1);
  const option = chooser.getByRole("link", { name: "Silver · 128GB", exact: true });
  await expect(option).toHaveCount(1); await option.focus(); await option.press("Enter");
  await expect(page).toHaveURL(/CV-E2E128GB/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Smartphone 128GB");
  await expect(page.getByRole("region", { name: "Purchase product" })).toContainText(/2\s*000/);
  await page.reload(); await expect(page).toHaveURL(/CV-E2E128GB/);
  await expect(page.getByRole("region", { name: "Purchase product" })).toContainText(/2\s*000/);
  const after = await page.request.get("/api/cart"); expect(after.status()).toBe(200);
  expect((await after.json()).cart).toEqual(cart);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`missing product media retains a visible gallery frame at ${viewport.width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    const before = await page.request.get("/api/cart"); expect(before.status()).toBe(200);
    const cart = (await before.json()).cart;
    await page.goto("/shop/products/e2e-smartphone-CP-E2ESMARTPHONE");
    const gallery = page.getByRole("region", { name: "E2E Smartphone 64GB image gallery", exact: true });
    const placeholder = gallery.getByText("Image unavailable", { exact: true }).first();
    await expect(placeholder).toBeVisible();
    const frame = placeholder.locator(".."); const bounds = await frame.boundingBox();
    expect(bounds).not.toBeNull(); expect(bounds!.height).toBeGreaterThanOrEqual(300);
    expect(bounds!.width).toBeGreaterThanOrEqual(300); expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
    await expect(frame.locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const after = await page.request.get("/api/cart"); expect(after.status()).toBe(200);
    expect((await after.json()).cart).toEqual(cart);
  });
}

test("short desktop purchase rail reveals keyboard-focused cart actions", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/shop/products/e2e-smartphone-CP-E2ESMARTPHONE");
  const purchase = page.getByRole("region", { name: "Purchase product", exact: true });
  const add = purchase.getByRole("button", { name: "Add to cart", exact: true });
  await add.focus(); await expect(add).toBeFocused();
  await expect.poll(async () => {
    const box = await add.boundingBox(); return box ? box.y + box.height : Infinity;
  }).toBeLessThanOrEqual(768);
  const bounds = await add.boundingBox(); expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(66); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(768);
  expect(await add.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest("button") === element;
  })).toBe(true);
  await add.press("Enter"); await expect(purchase.getByRole("status")).toContainText(/added|cart/i);
  const response = await page.request.get("/api/cart"); expect(response.status()).toBe(200);
  expect((await response.json()).cart.storeGroups[0].lines[0]).toMatchObject({ variantReference: "CV-E2E64GB", quantity: 1, lineTotal: "1500.00" });

});
