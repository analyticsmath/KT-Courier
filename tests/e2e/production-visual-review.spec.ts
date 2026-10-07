import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { login } from "./fixtures/auth";

async function capture(page: Page, testInfo: TestInfo, route: string, name: string) {
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
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true, animations: "disabled" });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  test(`capture actual public and protected surfaces for visual review at ${viewport.width}px`, async ({ page }, testInfo) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    await capture(page, testInfo, "/quote", "quote");
    await capture(page, testInfo, "/shop/products/e2e-smartphone-CP-E2ESMARTPHONE", "product");
    await login(page, "e2e-store@ktcouriers.local");
    await capture(page, testInfo, "/store/catalog", "store-catalog");
    await capture(page, testInfo, "/store/catalog/products/new", "catalog-wizard");
    await login(page, `e2e-onboarding-${viewport.width === 390 ? 390 : 1440}@ktcouriers.local`);
    await capture(page, testInfo, "/driver/profile", "driver-profile");
    await capture(page, testInfo, "/driver/onboarding", "driver-onboarding");
    await login(page, "superadmin@ktcouriers.local");
    await capture(page, testInfo, "/admin/production-readiness", "production-readiness");
    // Captures are review inputs, not a visual sign-off or complete functional acceptance.
  });
}
