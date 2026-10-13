import { expect, test } from "@playwright/test";

test("current cinematic homepage preserves the hero and loads parcel media on scroll", async ({ page }) => {
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hero = page.locator('[data-kt-scene="hero"]');
  await expect(hero.getByRole("heading", { name: "Shop local. Send with KT." })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Shop", exact: true })).toHaveAttribute("href", "/shop");
  await expect(hero.getByRole("link", { name: "Send a parcel" })).toHaveAttribute("href", "/services/parcel");

  // The cinematic layer mounts after the introductory curtain resolves.
  await expect(page.locator("[data-home-cinematic-layer]")).toHaveCount(1, { timeout: 15_000 });
  const deferred = page.locator("[data-box-plate], [data-vehicle-plate], [data-handoff-plate]");
  await expect(deferred).toHaveCount(4);
  for (const handle of await deferred.all()) {
    expect(await handle.getAttribute("src")).toBeNull();
  }

  const parcel = page.locator('[data-kt-scene="parcelization"]');
  await expect(parcel).toHaveCount(1);
  await parcel.evaluate((section) => {
    const bounds = section.getBoundingClientRect();
    const start = bounds.top + window.scrollY;
    window.scrollTo({ top: start + Math.min(window.innerHeight * 0.5, bounds.height * 0.25), behavior: "instant" });
  });

  const plate = page.locator("[data-box-plate]");
  await expect.poll(async () => plate.getAttribute("src"), { timeout: 15_000 }).toMatch(/\/media\/public\/KT_BOX_SEQUENCE_8_FRAMES\/box_[^/]+\.webp$/);
  await expect.poll(async () => plate.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
  expect(uncaught).toEqual([]);
});
