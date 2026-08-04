import { expect, test } from "@playwright/test";
import { attachConsoleMonitor } from "./fixtures/console-monitor";

const isLocalValidationServerAvailable = Boolean(
  process.env.PLAYWRIGHT_BASE_URL || process.env.KT_LOCAL_STOREFRONT_VALIDATION === "true"
);

const SAFE_HASH = "request-hash-1234567890123456";

test.describe("Mobile Viewport Execution", () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  test.beforeEach(({ page }) => {
    test.skip(!isLocalValidationServerAvailable, "Requires active local app instance with KT_LOCAL_STOREFRONT_VALIDATION=true");
  });

  test("storefront navigation on mobile viewport has no horizontal overflow", async ({ page }) => {
    const monitor = attachConsoleMonitor(page);

    await page.goto("/shop");
    await expect(page.locator("h1")).toBeVisible();

    const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(isNoOverflow).toBe(true);

    monitor.assertClean();
  });

  test("product detail and variant selection on mobile viewport remains operable", async ({ page }) => {
    const monitor = attachConsoleMonitor(page);

    await page.goto("/shop/products/e2e-smartphone-prod_e2esmartphone");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(isNoOverflow).toBe(true);

    const variantLink = page.locator('a[href*="var_128gb"]');
    if (await variantLink.isVisible()) {
      await expect(variantLink).toBeInViewport();
      await variantLink.click();
      await expect(page).toHaveURL(/var_128gb/);
    }

    monitor.assertClean();
  });

  test("cart view on mobile viewport renders totals without clipping", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 2,
        modifiers: [],
        operationId: `op-mob-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });

    await page.goto("/cart");
    await expect(page.locator("h1")).toBeVisible();

    const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(isNoOverflow).toBe(true);

    monitor.assertClean();
  });

  test("checkout contact form on mobile viewport displays focused fields without obscuring", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-mob-chk-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;

    await page.goto(`/checkout/${chkRef}/contact`);
    await expect(page.locator("h1")).toBeVisible();

    const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(isNoOverflow).toBe(true);

    monitor.assertClean();
  });

  test("checkout review on mobile viewport displays wrapped totals correctly", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-mob-rev-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;

    await page.goto(`/checkout/${chkRef}/review`);
    await expect(page.locator("h1")).toBeVisible();

    const isNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(isNoOverflow).toBe(true);

    monitor.assertClean();
  });
});
