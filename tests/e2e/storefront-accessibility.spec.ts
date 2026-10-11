import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`product quantity controls work with keyboard and announce persisted cart at ${viewport.width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport); await page.goto("/shop/products/e2e-smartphone-CP-E2ESMARTPHONE");
    const purchase = page.getByRole("region", { name: "Purchase product", exact: true });
    const decrease = purchase.getByRole("button", { name: "Decrease quantity", exact: true });
    await expect(decrease).toBeDisabled();
    const increase = purchase.getByRole("button", { name: "Increase quantity", exact: true });
    await increase.focus(); await increase.press("Enter"); await expect(decrease).toBeEnabled();
    const actions = viewport.width < 768 ? page.getByRole("region", { name: "Quick purchase dock", exact: true }) : purchase;
    const add = actions.getByRole("button", { name: "Add to cart", exact: true });
    await add.focus(); await add.press("Enter");
    await expect(purchase.getByRole("status")).toContainText(/added|cart/i);
    const cartRes = await page.request.get("/api/cart"); expect(cartRes.status()).toBe(200);
    const cart = (await cartRes.json()).cart;
    expect(cart.storeGroups[0].lines[0]).toMatchObject({ variantReference: "CV-E2E64GB", quantity: 2, lineTotal: "3000.00" });
    await page.goto("/cart"); await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("body")).toContainText("E2E Smartphone");
    const restored = await page.request.get("/api/cart"); expect(restored.status()).toBe(200);
    expect((await restored.json()).cart).toEqual(cart);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  });
}
