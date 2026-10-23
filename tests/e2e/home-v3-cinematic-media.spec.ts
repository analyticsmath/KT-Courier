import { expect, test } from "@playwright/test";

test("current editorial homepage preserves the hero and loads handoff media on scroll", async ({ page }) => {
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hero = page.locator('[data-home-chapter="opening"]');
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText("Good things.Going places.");
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(hero.getByRole("link", { name: /Discover the shop/ })).toHaveAttribute("href", "/shop");
  await expect(hero.getByRole("link", { name: /Send a parcel/ })).toHaveAttribute("href", "/services/parcel");
  const heroImage = hero.getByRole("img", { name: "A florist at the door of her neighbourhood flower shop" });
  await expect.poll(() => heroImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

  const handoff = page.locator('[data-home-chapter="handoff"]');
  await handoff.scrollIntoViewIfNeeded();
  await expect(handoff.getByRole("heading", { name: /A small handoff.*A bigger connection/ })).toBeVisible();
  const image = handoff.getByRole("img", { name: "A shopping bag changing hands, connecting a store and its customer" });
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
  await expect(handoff.getByRole("link", { name: /Let’s get it moving/ })).toHaveAttribute("href", "/quote");
  expect(uncaught).toEqual([]);
});
