import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { HOME_CHAPTERS, HOME_CHAPTER_BUDGETS_VH, HOME_MOBILE_CHAPTER_BUDGETS_VH, HOME_REDUCED_MOTION_PROGRESS, reducedMotionChapterProgress } from "@/components/public-v3/home/director/home-chapters";
import { HOME_CINEMATIC_ASSETS, HOME_ROUTE_VAN_SEQUENCE } from "@/components/public-v3/home/data/home-cinematic-assets.generated";
import { HOME_COMPOSED_ACTORS } from "@/components/public-v3/home/data/home-composed-actors.generated";
import { heroVisibleUnderMarketplace, resolveHomeCinematicFrame, routeCamera, routePoint, routePose } from "@/components/public-v3/home/director/home-cinematic-frame-resolver";
import { boxFlapPose, centeredFanOffset, effectiveScrollPixels, rollingPreloadIds, routeYawBlend, selectedProductForTakeover, truckTrailingEdgeReveal, uniformProductPose } from "@/components/public-v3/home/director/home-cinematic-mechanics";
import { resolveHeroVanFrame } from "@/components/public-v3/home/director/home-frame-resolver";

describe("post-Hero cinematic mechanics", () => {
  it("keeps the approved Hero visible until the Marketplace covers it", () => {
    for (const mode of ["desktop", "mobile"] as const) {
      const terminal = resolveHeroVanFrame(1, mode);
      expect(terminal.visible).toBe(true);
      expect(terminal.opacity).toBe(1);
    }
    expect(heroVisibleUnderMarketplace(.5)).toBe(true);
    expect(heroVisibleUnderMarketplace(1)).toBe(false);
  });

  it("clamps every chapter and gives mechanical and human actions physical scroll travel", () => {
    expect(HOME_CHAPTERS).toEqual(["hero", "commerce", "parcelization", "pickup", "network", "freight", "last-mile", "finale"]);
    for (const chapter of HOME_CHAPTERS) {
      expect(resolveHomeCinematicFrame(chapter, -1, false, 5, 5).progress).toBe(0);
      expect(resolveHomeCinematicFrame(chapter, 2, false, 5, 5).progress).toBe(1);
    }
    const viewport = 900;
    const parcelScroll = effectiveScrollPixels(HOME_CHAPTER_BUDGETS_VH.parcelization / 100 * viewport, viewport);
    const pickupScroll = effectiveScrollPixels(HOME_CHAPTER_BUDGETS_VH.pickup / 100 * viewport, viewport);
    expect(parcelScroll * .38).toBeGreaterThan(180);
    expect(pickupScroll * .19).toBeGreaterThan(180);
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH.commerce).toBeGreaterThan(100);
  });

  it("uses settled reduced-motion snapshots in narrative order", () => {
    for (const chapter of HOME_CHAPTERS.slice(1)) {
      const key = chapter as Exclude<typeof chapter, "hero">;
      const settled = reducedMotionChapterProgress(key);
      expect(settled).toBe(HOME_REDUCED_MOTION_PROGRESS[key]);
      expect(settled).toBeGreaterThan(0);
      expect(settled).toBeLessThanOrEqual(1);
      expect(resolveHomeCinematicFrame(key, settled, true, 5, 5).chapter).toBe(key);
    }
  });

  it("moves the product with one scale value and closes rigid flaps in order", () => {
    const source = { x: 100, y: 100, width: 400, height: 200 };
    const target = { x: 500, y: 300, width: 100, height: 100 };
    const end = uniformProductPose(source, target, 1);
    expect(end.scale).toBe(.25);
    expect(end.width * end.scale / (end.height * end.scale)).toBe(2);
    expect(end.x + end.width * end.scale / 2).toBe(550);
    expect(uniformProductPose(source, target, -1).scale).toBe(1);
    expect(boxFlapPose(0).left).toBe(72);
    expect(boxFlapPose(.55).left).toBe(0);
    expect(boxFlapPose(.55).rear).toBeLessThan(0);
    expect(boxFlapPose(.55).front).toBe(78);
    expect(boxFlapPose(1).front).toBe(0);
  });

  it("keeps the route continuous and blends only adjacent yaw plates", () => {
    expect(HOME_ROUTE_VAN_SEQUENCE).toHaveLength(7);
    expect(routePoint(.43).x).toBeCloseTo(.665, 2);
    const yaw = routeYawBlend(22);
    expect(yaw.lowerIndex).toBe(1);
    expect(yaw.upperIndex).toBe(2);
    expect(yaw.blend).toBeCloseTo(7 / 15);
    expect(yaw.lowerOpacity + yaw.upperOpacity).toBeCloseTo(1);
    for (let i = 0; i <= 100; i++) {
      const pose = routePose(i / 100);
      expect(pose.upperIndex - pose.lowerIndex).toBeLessThanOrEqual(1);
      expect(pose.yawBlend).toBeGreaterThanOrEqual(0);
      expect(pose.yawBlend).toBeLessThanOrEqual(1);
    }
    const point = routePoint(.72);
    const camera = routeCamera(point, { width: 1671, height: 941 }, { x: 800, y: 500 }, 1.4);
    expect(camera.x + point.x * 1671 * 1.4).toBeCloseTo(800);
    expect(camera.y + point.y * 941 * 1.4).toBeCloseTo(500);
  });

  it("attaches the Freight reveal to the measured trailing edge", () => {
    const bounds = { x: 20, y: 484, width: 1222, height: 298 };
    const a = truckTrailingEdgeReveal(800, 1400, 1254, bounds, 1000);
    expect(a.rearEdge).toBeCloseTo(100 + 1400 * 20 / 1254);
    expect(a.reveal).toBeCloseTo(a.rearEdge / 1000);
    const b = truckTrailingEdgeReveal(1700, 1400, 1254, bounds, 1000);
    expect(b.reveal).toBe(1);
  });

  it("preloads a small rolling yaw window", () => {
    expect(rollingPreloadIds(HOME_ROUTE_VAN_SEQUENCE, 0)).toHaveLength(3);
    expect(rollingPreloadIds(HOME_ROUTE_VAN_SEQUENCE, 3)).toHaveLength(4);
    expect(rollingPreloadIds(HOME_ROUTE_VAN_SEQUENCE, 6)).toHaveLength(2);
  });

  it("freezes the user's product before its parcel transition", () => {
    expect(selectedProductForTakeover("a", undefined, .8, .91)).toBeUndefined();
    expect(selectedProductForTakeover("b", undefined, .92, .91)).toBe("b");
    expect(selectedProductForTakeover("c", "b", .95, .91)).toBe("b");
  });

  it("places every selected product at the central dominant position", () => {
    for (let selected = 0; selected < 5; selected++) {
      const offsets = Array.from({ length: 5 }, (_, index) => centeredFanOffset(index, selected, 5));
      expect(offsets[selected]).toBe(0);
      expect([...offsets].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
    }
  });

  it("ships only active route/truck plates and composed actors with QC entries", async () => {
    expect(HOME_CINEMATIC_ASSETS).toHaveLength(8);
    expect(HOME_CINEMATIC_ASSETS.map((asset) => asset.family)).not.toContain("handoff");
    expect(HOME_COMPOSED_ACTORS).toHaveLength(13);
    const qc = JSON.parse(await readFile(path.join(process.cwd(), "components/public-v3/home/data/home-cinematic-assets.qc.json"), "utf8"));
    expect(qc.sourceInventory.length).toBeGreaterThan(60);
    expect(qc.assets).toHaveLength((8 + 13) * 2);
    for (const asset of [...HOME_CINEMATIC_ASSETS, ...HOME_COMPOSED_ACTORS]) {
      const urls = "desktopSrc" in asset ? [asset.desktopSrc, asset.mobileSrc] : [asset.desktop, asset.mobile];
      for (const url of urls) {
        const file = path.join(process.cwd(), "public", url.slice(1));
        expect((await stat(file)).size).toBeGreaterThan(0);
        expect((await sharp(file).metadata()).hasAlpha).toBe(true);
      }
    }
  }, 30000);
});
