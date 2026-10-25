import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

async function checkSurface(page: Page, route: string) {
  await page.goto(route);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `${route} must fit the viewport`).toBe(false);
  if (route === "/store/catalog" || route === "/store/catalog/products/new") {
    const marketplace = page.getByRole("link", { name: "View live marketplace", exact: true });
    await expect(marketplace).toBeVisible();
    expect(await marketplace.evaluate(element => element.getClientRects().length), "Marketplace action must remain one readable line inside a narrow panel").toBe(1);
  }
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
  test(`public and protected headings and navigation fit the viewport at ${viewport.width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    await checkSurface(page, "/quote");
    await checkSurface(page, "/shop/products/e2e-smartphone-CP-E2ESMARTPHONE");
    await login(page, "e2e-store@ktcouriers.local");
    await checkSurface(page, "/store/catalog");
    await checkSurface(page, "/store/catalog/products/new");
    await login(page, `e2e-onboarding-${viewport.width === 390 ? 390 : 1440}@ktcouriers.local`);
    await checkSurface(page, "/driver/profile");
    await checkSurface(page, "/driver/onboarding");
    await login(page, "superadmin@ktcouriers.local");
    await checkSurface(page, "/admin/production-readiness");
    // Functional assertions do not replace the required native browser review.
  });
}

// The phone product dock and fixed navigation must not obscure actionable UI.
// Both controls are rendered on real public routes in the disposable browser.
for (const viewport of [{ width: 320, height: 720 }, { width: 768, height: 1024 }]) {
  test(`quote labels and mobile product footer controls remain unobscured at ${viewport.width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    await page.goto("/quote");
    const province = page.locator('label[for="pickup-province"]');
    await expect(province).toBeVisible();
    await province.evaluate(element => element.scrollIntoView({ block: "start" }));
    const labelBounds = await province.boundingBox();
    const headerBounds = await page.locator(".kt-new-header").boundingBox();
    expect(labelBounds && headerBounds && labelBounds.y >= headerBounds.y + headerBounds.height + 4,
      "Navigating to a quote label must not place it beneath the fixed header").toBe(true);

    await page.goto("/shop/products/e2e-smartphone-CP-E2ESMARTPHONE");
    const dock = page.getByRole("region", { name: "Quick purchase dock" });
    const safety = page.locator('footer nav[aria-label="Policies"] a[href="/safety"]');
    await expect(dock).toBeVisible();
    await expect(safety).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const dockBounds = await dock.boundingBox();
    const safetyBounds = await safety.boundingBox();
    expect(safetyBounds && dockBounds && safetyBounds.y + safetyBounds.height + 4 <= dockBounds.y,
      "Policy links must remain fully above the fixed purchase dock at the end of the page").toBe(true);
  });
}
