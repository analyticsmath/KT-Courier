import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const roles = [
  { role: "customer", email: "tanya.chetty2@example.co.za", root: "/account", pages: ["/account/orders", "/account/request-delivery", "/account/wallet"] },
  { role: "store", email: "store.table-bay-marine-goods@ktcouriers.local", root: "/store", pages: ["/store/marketplace-orders", "/store/earnings", "/store/catalog"] },
  { role: "driver", email: "driver.katlego.padayachee5@ktcouriers.local", root: "/driver", pages: ["/driver/assignments", "/driver/earnings"] },
  { role: "promoter", email: "promoter.preetha.ncube6@ktcouriers.local", root: "/promoter", pages: ["/promoter/links", "/promoter/referrals", "/promoter/earnings"] },
  { role: "admin", email: "superadmin@ktcouriers.local", root: "/admin", pages: ["/admin/orders", "/admin/dispatch", "/admin/finance"] },
  { role: "applicant", email: "tanya.chetty2@example.co.za", root: "/applicant", pages: ["/applicant/applications", "/applicant/privacy"] },
  { role: "developer", email: "tanya.chetty2@example.co.za", root: "/developers/applications", pages: ["/developers/credentials", "/developers/usage"] },
] as const;

const stage = process.env.KT_SCREENSHOT_STAGE ?? "after";
mkdirSync(`output/playwright/control-desk/${stage}`, { recursive: true });
for (const role of roles) {
  test(`${role.role} workspace viewport and navigation evidence`, async ({ page }) => {
    const response = await page.request.post("/api/auth/login", { data: { email: role.email, password: process.env.KT_DEMO_ACCOUNT_PASSWORD } });
    expect(response.status(), `Login for ${role.role}`).toBe(200);
    for (const [width, height] of [[390, 844], [768, 1024], [1024, 768], [1440, 1000], ...(role.role === "admin" ? [[1728, 1117]] : [])]) {
      await page.setViewportSize({ width, height });
      await page.goto(role.root);
      await expect(page.locator('[data-kt-protected-system="editorial-operations-v1"]')).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      await page.screenshot({ path: `output/playwright/control-desk/${stage}/${role.role}-${width}.png`, fullPage: true });
      if (stage !== "before") {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (role.role !== "applicant" && width < 1024) {
          await page.getByRole("button", { name: "Open navigation", exact: true }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
        }
      }
    }
    if (stage !== "before") {
      for (const route of role.pages) {
        await page.goto(route);
        await expect(page.locator('[data-kt-protected-system="editorial-operations-v1"]')).toBeVisible();
        await expect(page.locator("h1")).toHaveCount(1);
      }
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(role.root);
      const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((node) => node.getBoundingClientRect().right > innerWidth + 1).map((node) => ({ tag: node.tagName, class: node.className, width: node.getBoundingClientRect().width })).slice(0, 10));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow)).toBe(true);
      await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
      await page.screenshot({ path: `output/playwright/control-desk/${stage}/${role.role}-forced-colors.png`, fullPage: true });
    }
  });
}
