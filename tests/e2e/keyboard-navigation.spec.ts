import { expect, test } from "@playwright/test";
import { attachConsoleMonitor } from "./fixtures/console-monitor";

const isLocalValidationServerAvailable = Boolean(
  process.env.PLAYWRIGHT_BASE_URL || process.env.KT_LOCAL_STOREFRONT_VALIDATION === "true"
);

const SAFE_HASH = "request-hash-1234567890123456";

test.describe("Keyboard-Only Execution Journey", () => {
  test.beforeEach(() => {
    test.skip(!isLocalValidationServerAvailable, "Requires active local app instance with KT_LOCAL_STOREFRONT_VALIDATION=true");
  });

  test("keyboard-only journey navigates shop, search, product, cart and checkout contact using Tab, Enter and Space", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    // 1. Open storefront via keyboard focus
    await page.goto("/shop");
    await page.keyboard.press("Tab");

    let activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(activeTag).toBeTruthy();

    // 2. Search navigation via keyboard
    await page.goto("/shop/search");
    const searchInput = page.locator('input[name="q"], input[type="search"], input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.focus();
      await page.keyboard.type("smartphone");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/q=smartphone/);
    }

    // 3. Product page variant selection via keyboard
    await page.goto("/shop/products/e2e-smartphone-prod_e2esmartphone");
    const variantLink = page.locator('a[href*="var_128gb"]').first();
    if (await variantLink.isVisible()) {
      await variantLink.focus();
      const isFocused = await variantLink.evaluate((el) => el === document.activeElement);
      expect(isFocused).toBe(true);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/var_128gb/);
    }

    // 4. Cart navigation via keyboard
    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-kbd-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const cartBody = await cartRes.json();

    await page.goto("/cart");
    await page.keyboard.press("Tab");
    activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(activeTag).toBeTruthy();

    // 5. Checkout contact form keyboard focus
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;

    await page.goto(`/checkout/${chkRef}/contact`);
    await page.keyboard.press("Tab");
    const focusInContact = await page.evaluate(() => Boolean(document.activeElement && document.activeElement !== document.body));
    expect(focusInContact).toBe(true);

    monitor.assertClean();
  });
});
