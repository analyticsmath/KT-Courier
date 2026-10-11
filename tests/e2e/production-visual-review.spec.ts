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

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
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
