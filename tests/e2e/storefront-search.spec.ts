import { expect, test } from "@playwright/test";

test.describe("public marketplace search", () => {
  test("URL query filters the result grid and browser history restores query and products", async ({ page }) => {
    await page.goto("/shop/search?q=headphones", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Results for “headphones”" })).toBeVisible();
    const resultList = page.getByRole("list", { name: 'Results for “headphones”' });
    const productTitles = resultList.getByRole("heading", { level: 3 });
    await expect.poll(() => productTitles.count(), { timeout: 15000 }).toBeGreaterThan(0);
    const headphoneTitles = await productTitles.allTextContents();
    expect(headphoneTitles.length).toBeGreaterThan(0);
    for (const title of headphoneTitles) {
      expect(title).toMatch(/headphone|earbud|earphone|headset|audio/i);
      expect(title).not.toMatch(/car mat|laptop stand/i);
    }

    const input = page.getByRole("combobox", { name: "Search the marketplace" });
    await input.fill("car mat");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/shop\/search\?[^#]*q=car(?:\+|%20)mat|\/shop\/search\?q=car(?:\+|%20)mat/);
    await expect(page.getByRole("heading", { name: "Results for “car mat”" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/q=headphones/);
    await expect(page.getByRole("heading", { name: "Results for “headphones”" })).toBeVisible();
    await expect(input).toHaveValue("headphones");
    const restoredTitles = await page.getByRole("list", { name: 'Results for “headphones”' }).getByRole("heading", { level: 3 }).allTextContents();
    expect(restoredTitles).toEqual(headphoneTitles);
  });

  test("keyboard selection of a suggestion navigates to its authoritative result URL", async ({ page }) => {
    await page.goto("/shop/search", { waitUntil: "domcontentloaded" });
    const input = page.getByRole("combobox", { name: "Search the marketplace" });
    await input.fill("headphones");
    await input.press("ArrowDown");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/shop\/search\?[^#]*q=headphones/);
    await expect(page.getByRole("heading", { name: "Results for “headphones”" })).toBeVisible();
    const productTitles = await page.getByRole("list", { name: 'Results for “headphones”' }).getByRole("heading", { level: 3 }).allTextContents();
    expect(productTitles.length).toBeGreaterThan(0);
    expect(productTitles.every((title) => /headphone|earbud|earphone|headset|audio/i.test(title))).toBe(true);
  });

  test("adding a live result updates the header count and survives reload", async ({ page }) => {
    await page.goto("/shop/search?q=headphones", { waitUntil: "networkidle" });
    const resultList = page.getByRole("list", { name: 'Results for “headphones”' });
    await resultList.getByRole("button", { name: "Add to cart" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const offers = dialog.getByRole("radio");
    await expect(offers.first()).toBeVisible({ timeout: 15000 });
    await offers.first().click();
    await dialog.getByRole("button", { name: "Add to cart" }).click();
    await expect(dialog.locator('p[role="status"]')).toHaveText("Added to your cart.", { timeout: 15000 });
    await expect(page.locator("header[data-tone] [data-kt-cart-target='header']"))
      .toHaveAttribute("aria-label", "Shopping cart containing 1 items");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("header[data-tone] [data-kt-cart-target='header']"))
      .toHaveAttribute("aria-label", "Shopping cart containing 1 items");
  });
});
