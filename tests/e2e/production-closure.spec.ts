import { expect, test } from "@playwright/test";
import { login, logout } from "./fixtures/auth";
test("anonymous quote copy and form semantics work on desktop and mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 844 }, { width: 720, height: 450 }]) {
    await page.setViewportSize(viewport); await page.goto("/quote");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("group", { name: "Collection address", exact: true }).getByRole("textbox", { name: "Street address", exact: true })).toBeFocused();
    await expect(page.getByText("No account needed to start.", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByLabel("Parcel size", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Calculate delivery price", exact: true })).toBeVisible();
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

test("public navigation drawer stays inert while closed and contains keyboard focus while open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/quote");

  const drawer = page.locator("#kt-editorial-menu");
  const shopLink = drawer.locator('a[href="/shop"]');
  await expect(drawer).not.toBeVisible();
  const hiddenLinkReceivedFocus = await shopLink.evaluate((element) => {
    (element as HTMLElement).focus();
    return document.activeElement === element;
  });
  expect(hiddenLinkReceivedFocus).toBe(false);

  const openButton = page.getByRole("button", { name: "Menu", exact: true });
  await openButton.focus();
  await page.keyboard.press("Enter");
  await expect(drawer).toBeVisible();
  const firstMenuControl = drawer.locator("a, button").first();
  await expect(firstMenuControl).toBeFocused();

  const finalMenuLink = drawer.getByRole("link", { name: "Terms", exact: true });
  await page.keyboard.press("Shift+Tab");
  await expect(finalMenuLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstMenuControl).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(openButton).toHaveAttribute("aria-expanded", "false");
  await expect(openButton).toBeFocused();
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
