import { expect, test } from "@playwright/test";
import { attachConsoleMonitor } from "./fixtures/console-monitor";

const isLocalValidationServerAvailable = Boolean(
  process.env.PLAYWRIGHT_BASE_URL || process.env.KT_LOCAL_STOREFRONT_VALIDATION === "true"
);

test.describe("Storefront Browsing & Discovery", () => {
  test.beforeEach(() => {
    if (!isLocalValidationServerAvailable) throw new Error("Run through the disposable E2E runner.");
  });

  test("untrusted lock headers cannot change the canonical exposure decision", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-kt-storefront-lock": "true" });
    await page.goto("/shop");
    await expect(page.locator("h1:visible")).toContainText(/Shop|Discover/i);
    await expect(page.locator("body")).not.toContainText("The marketplace catalogue is not available yet");
    await expect(page.locator('a[href*="CP-E2ESMARTPHONE"]').first()).toBeVisible();
  });

  test("safely activated state renders canonical storefront heading and source-backed content", async ({ page }) => {
    const monitor = attachConsoleMonitor(page);

    await page.goto("/shop");

    const heading = page.locator("h1:visible");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Marketplace|Shop/i);

    await expect(page.locator("body")).not.toContainText("The marketplace catalogue is not available yet");

    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Electronics");
    expect(pageContent).toContain("E2E Store");

    const titleMeta = await page.title();
    expect(titleMeta).toBeTruthy();
    expect(titleMeta.length).toBeGreaterThan(3);

    monitor.assertClean();
  });

  test("search filters known products by query and reflects normalized query state in URL", async ({ page }) => {
    const monitor = attachConsoleMonitor(page);

    await page.goto("/shop/search?q=smartphone");

    await expect(page).toHaveURL(/\/shop\/search\?q=smartphone/);

    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("E2E Smartphone");
    expect(bodyText).not.toContain("Wireless Headphones");

    await page.goto("/shop/search");
    await expect(page.locator("body")).toBeVisible();

    monitor.assertClean();
  });

  test("category browsing displays category hierarchy, breadcrumbs and eligible products", async ({ page }) => {
    const monitor = attachConsoleMonitor(page);

    await page.goto("/shop/categories/electronics");

    const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"], .breadcrumb');
    await expect(breadcrumbs).toBeVisible();
    await expect(breadcrumbs).toContainText("Electronics");

    const heading = page.locator("h1:visible");
    await expect(heading).toContainText("Electronics");

    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("E2E Smartphone");

    await page.goto("/shop/categories/nonexistent-category-slug-999");
    const notFoundHeading = page.locator("h1:visible");
    await expect(notFoundHeading).toBeVisible();

    monitor.assertClean();
  });

  test("product detail page displays store, variant selection, price and handles variant changes", async ({ page }) => {
    const monitor = attachConsoleMonitor(page);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/shop/products/e2e-smartphone-CP-E2ESMARTPHONE");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Smartphone 64GB");
      const purchase = page.getByRole("region", { name: "Purchase product", exact: true });
      await expect(purchase.getByRole("radio", { name: /E2E Store R\s*1\s*500,00/ })).toBeChecked();
      await expect(purchase).toContainText(/R\s*1\s*500,00/);
      const chooser = purchase.getByRole("group", { name: "Available product variants", exact: true });
      await expect(chooser).toHaveCount(1);
      const variantLink = chooser.getByRole("link", { name: "Silver · 128GB", exact: true });
      await expect(variantLink).toHaveCount(1);
      await expect(variantLink).toBeVisible();
      await expect(variantLink).toHaveAttribute("href", "/shop/products/e2e-smartphone-CP-E2ESMARTPHONE/CV-E2E128GB");
      await variantLink.click();
      await expect(page).toHaveURL(/CV-E2E128GB/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Smartphone 128GB");
      await expect(purchase).toContainText(/R\s*2\s*000,00/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await page.goto("/shop/products/e2e-smartphone-CP-E2ESMARTPHONE/invalid_variant_ref_999");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("That marketplace item is not available.");
      await expect(page.getByRole("region", { name: "Purchase product", exact: true })).toHaveCount(0);
    }
    monitor.assertClean();
  });

  test("store detail page renders public store identity and eligible catalog items without private fields", async ({ page }) => {
    const monitor = attachConsoleMonitor(page);

    await page.goto("/shop/stores/e2e-store");

    const heading = page.locator("h1:visible");
    await expect(heading).toContainText("E2E Store");

    const content = await page.content();
    expect(content).toContain("E2E Smartphone");

    expect(content).not.toContain("ownerUserId");
    expect(content).not.toContain("passwordHash");
    expect(content).not.toContain("e2e-store@ktcouriers.local");

    monitor.assertClean();
  });

  test("media fallback presents neutral image placeholder for products without media", async ({ page }) => {
    const monitor = attachConsoleMonitor(page);

    await page.goto("/shop/products/e2e-product-no-media-CP-E2ENOMEDIA");

    const heading = page.locator("h1:visible");
    await expect(heading).toContainText("E2E Product No Media");

    const gallery = page.getByRole("region", { name: "E2E Product No Media image gallery", exact: true });
    const fallbackImage = gallery.getByText("Image unavailable", { exact: true }).filter({ visible: true });
    await expect(fallbackImage).toHaveCount(1);
    await expect(fallbackImage).toBeVisible();

    const brokenImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).filter((img) => img.naturalWidth === 0 && img.src !== "");
    });
    expect(brokenImages.length).toBe(0);

    monitor.assertClean();
  });
});
