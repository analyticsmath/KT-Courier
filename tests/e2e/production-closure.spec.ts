import { expect, test } from "@playwright/test";
import { login, logout } from "./fixtures/auth";
test("anonymous quote copy and form semantics work on desktop and mobile", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.goto("/quote");
    await expect(page.getByText("Get a quotation without an account.", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByLabel("Parcel size", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /quote|estimate/i }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); expect(overflow).toBe(false);
  }
  for (const path of ["/services/pricing", "/faq"]) {
    await page.goto(path); await expect(page.locator("body")).not.toContainText(/quote preparation requires authentication|authenticated (?:quote|delivery request) flow|create an account before.*quote/i);
  }
  const question = page.locator("summary").filter({ hasText: "How is a quote prepared?" });
  await expect(question).toHaveCount(1); await question.click();
  await expect(page.locator("details[open]")).toContainText("without an account");
  await page.getByRole("searchbox", { name: "Search FAQ questions" }).fill("disposable-unmatched-query");
  await expect(page.getByRole("button", { name: "Clear search filter" })).toBeVisible();
});
test("protected readiness, parcel and marketplace configuration surfaces enforce roles and expose safe gates", async ({ page }) => {
  await login(page, "superadmin@ktcouriers.local");
  for (const [path, heading] of [["/admin/production-readiness", "Production readiness"], ["/admin/parcel-profiles", "Parcel profiles"], ["/admin/marketplace-delivery-policy", "Marketplace delivery policy"]]) {
    await page.goto(path); await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/sk_live_|CLOUDINARY_API_SECRET|RESEND_API_KEY/);
  }
  await logout(page); await login(page, "customer@ktcouriers.local");
  for (const path of ["/api/admin/production-readiness", "/api/admin/parcel-profiles", "/api/admin/marketplace-delivery-policy"]) expect((await page.request.get(path)).status()).toBe(403);
});
