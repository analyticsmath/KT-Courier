import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Chapter = "hero" | "marketplace" | "fan" | "preparation" | "collection" | "custody" | "route" | "freight" | "arrival" | "finale";
type FrameSnapshot = {
  chapter: string;
  progress: number;
  owner: string;
  selectedId: string;
  headerTone: string;
  occlusion: string;
  actors: Record<string, { visible: boolean; state: string }>;
  marketplaceOwner: string | null;
  fanSelection: string | null;
  fanVisibleMedia: string[];
  routePathProgress: number;
};

const sceneName: Record<Chapter, string> = {
  hero: "hero",
  marketplace: "marketplace",
  fan: "image-fan",
  preparation: "preparation",
  collection: "collection",
  custody: "custody",
  route: "route",
  freight: "freight",
  arrival: "arrival",
  finale: "finale",
};

const desktopCheckpoints: Array<[Chapter, number, string]> = [
  ["hero", 0.00, "poster"], ["hero", 0.16, "approach"], ["hero", 0.29, "braking"],
  ["hero", 0.39, "hold"], ["hero", 0.52, "hold-end"], ["hero", 0.66, "acceleration"],
  ["hero", 0.82, "trailer"], ["hero", 0.89, "cargo-takeover"], ["hero", 0.95, "three-panel"], ["hero", 0.985, "five-panel"],
  ["marketplace", 0.08, "category-incoming"], ["marketplace", 0.50, "category-hold"], ["marketplace", 0.84, "category-departure"],
  ["fan", 0.08, "inherited-card"], ["fan", 0.40, "spread-hold"], ["fan", 0.60, "compression"], ["fan", 0.75, "selected-hold"], ["fan", 0.96, "parcel-transfer"],
  ["preparation", 0.50, "ready-hold"], ["preparation", 0.92, "collection-underlay"],
  ["collection", 0.05, "environment"], ["collection", 0.22, "van-approach"], ["collection", 0.49, "closed-van-hold"],
  ["collection", 0.67, "door-opening"], ["collection", 0.76, "courier-lift"], ["collection", 0.87, "courier-load"], ["collection", 0.97, "resolved"],
  ["custody", 0.48, "seam-hold"], ["custody", 0.78, "route-material"],
  ["route", 0.20, "straight"], ["route", 0.60, "overpass-a"], ["route", 0.70, "angled"], ["route", 0.84, "canopy-b"], ["route", 0.91, "turning"], ["route", 0.97, "terminal-takeover"],
  ["freight", 0.24, "entry"], ["freight", 0.49, "side-hold"], ["freight", 0.77, "climax"], ["freight", 0.86, "climax-hold"], ["freight", 0.97, "release"],
  ["arrival", 0.20, "courier-entry"], ["arrival", 0.50, "human-hold"], ["arrival", 0.83, "handoff"], ["arrival", 0.94, "footer-release"],
  ["finale", 0.30, "footer"], ["finale", 0.90, "footer-settled"],
];

async function seek(page: Page, chapter: Chapter, progress: number): Promise<void> {
  const selector = `[data-kt-scene="${sceneName[chapter]}"]`;
  const section = page.locator(selector);
  await expect(section).toHaveCount(1);
  const geometry = await section.evaluate((element) => {
    const height = element.getBoundingClientRect().height;
    const stage = element.querySelector<HTMLElement>("[data-home-sticky-stage], .kt-home-sticky-stage, [data-marketplace-sticky-stage]");
    const sticky = Boolean(stage && getComputedStyle(stage).position === "sticky");
    return {
      top: element.getBoundingClientRect().top + window.scrollY,
      scrollSpan: Math.max(1, height - (sticky ? window.innerHeight : 0)),
    };
  });
  await page.evaluate(({ top, scrollSpan, progress }) => window.scrollTo({ top: top + scrollSpan * Math.min(progress, 0.995), behavior: "instant" }), { ...geometry, progress });
  await expect.poll(async () => page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-chapter"), { timeout: 8000 }).toBe(chapter);
  await expect.poll(async () => Number(await page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-progress")), { timeout: 8000 }).toBeGreaterThan(progress - 0.025);
  await expect.poll(async () => Number(await page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-progress")), { timeout: 8000 }).toBeLessThan(progress + 0.025);
  await page.waitForTimeout(80);
}

async function snapshot(page: Page): Promise<FrameSnapshot> {
  return page.locator("[data-kt-motion-owned='director']").evaluate((root) => {
    const visibleState = (slot: HTMLElement | null) => {
      const visible = slot && Number.parseFloat(getComputedStyle(slot).opacity) > 0.5;
      const layer = slot ? Array.from(slot.querySelectorAll<HTMLElement>("[data-actor-state-layer]")).find((item) => Number.parseFloat(getComputedStyle(item).opacity) > 0.5) : null;
      return { visible: Boolean(visible), state: layer?.dataset.actorStateLayer ?? "none" };
    };
    const fanLayers = Array.from(root.querySelectorAll<HTMLElement>("[data-fan-media-id]"));
    return {
      chapter: root.getAttribute("data-home-chapter") ?? "",
      progress: Number(root.getAttribute("data-home-progress") ?? 0),
      owner: root.getAttribute("data-home-world-owner") ?? "",
      selectedId: root.getAttribute("data-home-selected-marketplace-id") ?? "",
      headerTone: document.querySelector<HTMLElement>("header[data-tone]")?.dataset.tone ?? "",
      occlusion: root.getAttribute("data-home-occlusion") ?? "",
      actors: {
        whiteTruck: visibleState(root.querySelector<HTMLElement>("[data-actor-slot='white-truck']")),
        van: visibleState(root.querySelector<HTMLElement>("[data-actor-slot='van']")),
        courier: visibleState(root.querySelector<HTMLElement>("[data-actor-slot='courier']")),
        redTruck: visibleState(root.querySelector<HTMLElement>("[data-actor-slot='red-truck']")),
      },
      marketplaceOwner: root.querySelector<HTMLElement>("[data-marketplace-active='true']")?.dataset.marketplacePanelId ?? null,
      fanSelection: root.querySelector<HTMLElement>("[data-motion='fan-hero']")?.dataset.fanCardId ?? null,
      fanVisibleMedia: fanLayers.filter((layer) => Number.parseFloat(getComputedStyle(layer).opacity) > 0.5).map((layer) => layer.dataset.fanMediaId ?? ""),
      routePathProgress: Number(root.getAttribute("data-home-route-progress") ?? 0),
    };
  });
}

async function capture(page: Page, testInfo: TestInfo, chapter: Chapter, progress: number, label: string): Promise<FrameSnapshot> {
  await seek(page, chapter, progress);
  const state = await snapshot(page);
  if (testInfo.project.name === "cinematic-1440") {
    const directory = path.join("output", "playwright", "cinematic", testInfo.project.name);
    await mkdir(directory, { recursive: true });
    const basename = `${chapter}-${Math.round(progress * 1000).toString().padStart(3, "0")}-${label}`;
    await page.screenshot({ path: path.join(directory, `${basename}.png`) });
    await writeFile(path.join(directory, `${basename}.json`), `${JSON.stringify(state, null, 2)}\n`);
  }
  return state;
}

test.describe("cinematic homepage runtime", () => {
  test.setTimeout(180_000);

  test("scroll checkpoints preserve one owner, valid actors and category identity", async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-kt-motion-owned='director']");
    await expect(root).toBeVisible();
    await expect.poll(async () => root.getAttribute("data-home-chapter"), { timeout: 30000 }).not.toBeNull();
    await expect(page.locator("[data-actor-slot='white-truck'] [data-actor-state-layer='side-right']")).toHaveCount(1);

    const checkpoints = testInfo.project.name === "cinematic-1440"
      ? desktopCheckpoints
      : ([
          ["hero", 0.39, "hero-hold"], ["hero", 0.66, "hero-departure"],
          ["marketplace", 0.50, "marketplace"], ["fan", 0.40, "fan-spread"],
          ["collection", 0.67, "collection-door"], ["route", 0.70, "route"],
          ["freight", 0.86, "freight-hold"], ["arrival", 0.83, "arrival-handoff"], ["finale", 0.30, "footer"],
        ] satisfies Array<[Chapter, number, string]>);

    const observed: FrameSnapshot[] = [];
    for (const [chapter, progress, label] of checkpoints) {
      const frame = await capture(page, testInfo, chapter, progress, label);
      observed.push(frame);
      const visibleVehicles = [frame.actors.whiteTruck, frame.actors.van, frame.actors.redTruck].filter((actor) => actor.visible);
      expect(visibleVehicles.length, `${chapter} at ${progress}`).toBeLessThanOrEqual(1);
      expect(frame.headerTone).toMatch(/^(light|dark)$/);

      if (chapter === "hero" && progress >= 0.60) {
        const actionsOpacity = await page.locator("[data-motion='hero-actions']").evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
        expect(actionsOpacity).toBeLessThan(0.05);
      }
      if (chapter === "hero" && progress < 0.92) expect(frame.actors.whiteTruck.state).toBe("side-right");
      if (chapter === "marketplace") {
        expect(frame.marketplaceOwner).toBeTruthy();
        const card = page.locator(`[data-marketplace-panel-id="${frame.marketplaceOwner}"]`);
        await expect(card.locator("img")).toHaveAttribute("alt", /.+/);
        await expect(card.locator("h3")).toBeVisible();
      }
      if (chapter === "fan") {
        expect(frame.fanSelection).toBe(frame.selectedId);
        expect(frame.fanVisibleMedia).toEqual([frame.selectedId]);
        expect(await page.locator(".kt-fan-support-card").count()).toBeLessThanOrEqual(4);
      }
      if (chapter === "collection" && progress >= 0.49 && progress <= 0.97) expect(frame.actors.van.visible).toBe(true);
      if (chapter === "route" && progress >= 0.20 && progress <= 0.91) expect(frame.actors.whiteTruck.visible).toBe(true);
      if (chapter === "freight" && progress === 0.86) expect(frame.actors.redTruck.visible).toBe(true);
      if (chapter === "arrival" && progress >= 0.83) {
        expect(frame.actors.redTruck.visible).toBe(false);
        expect(frame.actors.courier.visible).toBe(true);
      }
      if (chapter === "finale") expect(Object.values(frame.actors).some((actor) => actor.visible)).toBe(false);
    }

    const finalMarketplace = observed.find((frame) => frame.chapter === "marketplace" && frame.progress >= 0.80);
    const fan = observed.find((frame) => frame.chapter === "fan");
    if (finalMarketplace && fan) expect(fan.selectedId).toBe(finalMarketplace.marketplaceOwner);
    expect(pageErrors).toEqual([]);
  });

  test("reverse scroll reconstructs the same frame and fast jumps land in the requested world", async ({ page }) => {
    test.skip(test.info().project.name !== "cinematic-1440", "Reverse and deep-jump checks run on the primary desktop viewport.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const checkpoints: Array<[Chapter, number]> = [["preparation", 0.5], ["collection", 0.49], ["route", 0.7], ["freight", 0.86], ["arrival", 0.5]];
    const forward = new Map<string, FrameSnapshot>();
    for (const [chapter, progress] of checkpoints) {
      await seek(page, chapter, progress);
      forward.set(`${chapter}:${progress}`, await snapshot(page));
    }
    for (const [chapter, progress] of checkpoints.slice().reverse()) {
      await seek(page, chapter, progress);
      const backward = await snapshot(page);
      const original = forward.get(`${chapter}:${progress}`)!;
      expect({ ...backward, progress: original.progress }).toEqual(original);
    }

    for (const [chapter, progress] of [["collection", 0.67], ["fan", 0.75], ["freight", 0.86], ["arrival", 0.83]] as Array<[Chapter, number]>) {
      await seek(page, chapter, progress);
      const frame = await snapshot(page);
      expect(frame.chapter).toBe(chapter);
      expect(frame.owner).toMatch(new RegExp(`^${chapter}$|^(marketplace|preparation|collection|custody|route|freight|arrival|finale)$`));
      expect([frame.actors.whiteTruck, frame.actors.van, frame.actors.redTruck].filter((actor) => actor.visible).length).toBeLessThanOrEqual(1);
    }
  });

  test("deep refresh restores the same selected identity and chapter state", async ({ page }) => {
    test.skip(test.info().project.name !== "cinematic-1440", "Deep-refresh checks run on the primary desktop viewport.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    for (const chapter of ["marketplace", "fan", "preparation", "collection", "route", "freight", "arrival"] as Chapter[]) {
      await seek(page, chapter, chapter === "freight" || chapter === "arrival" ? 0.5 : 0.45);
      const before = await snapshot(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect.poll(async () => page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-chapter"), { timeout: 30000 }).toBe(chapter);
      await expect.poll(async () => Number(await page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-progress")), { timeout: 10000 }).toBeGreaterThan(0.4);
      const after = await snapshot(page);
      expect(after.chapter).toBe(before.chapter);
      expect(after.selectedId).toBe(before.selectedId);
      if (chapter === "fan") expect(after.fanVisibleMedia).toEqual([after.selectedId]);
    }
  });

  test("desktop resize keeps the active chapter and normalized progress", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "cinematic-1440", "Resize continuity runs on the primary desktop viewport.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await seek(page, "collection", 0.67);
    const before = await snapshot(page);

    await page.setViewportSize({ width: 1366, height: 768 });
    await expect.poll(async () => page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-chapter"), { timeout: 10000 }).toBe("collection");
    await expect.poll(async () => Number(await page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-progress")), { timeout: 10000 }).toBeGreaterThan(0.64);
    await expect.poll(async () => Number(await page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-progress")), { timeout: 10000 }).toBeLessThan(0.70);
    const resized = await snapshot(page);
    expect(resized.selectedId).toBe(before.selectedId);
    expect(resized.actors.van.visible).toBe(true);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(async () => Number(await page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-progress")), { timeout: 10000 }).toBeGreaterThan(0.64);
    await expect.poll(async () => Number(await page.locator("[data-kt-motion-owned='director']").getAttribute("data-home-progress")), { timeout: 10000 }).toBeLessThan(0.70);
  });
});
