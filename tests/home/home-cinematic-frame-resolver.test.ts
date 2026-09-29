import { stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { HOME_CHAPTERS, HOME_CHAPTER_BUDGETS_VH, HOME_MOBILE_CHAPTER_BUDGETS_VH, HOME_REDUCED_MOTION_PROGRESS } from "@/components/public-v3/home/director/home-chapters";
import { HOME_BOX_SEQUENCE, HOME_CINEMATIC_ASSETS, HOME_DELIVERY_SEQUENCE, HOME_HANDOFF_SEQUENCE, HOME_PICKUP_SEQUENCE, HOME_RETURN_SEQUENCE, HOME_ROUTE_VAN_SEQUENCE } from "@/components/public-v3/home/data/home-cinematic-assets.generated";
import { deliveryFrameIndex, heroVisibleUnderMarketplace, pickupFrameIndex, resolveHomeCinematicFrame, returnFrameIndex, routeCamera, routePoint, routePose, selectedProductIndex, sequenceIndex } from "@/components/public-v3/home/director/home-cinematic-frame-resolver";
import { resolveHeroVanFrame } from "@/components/public-v3/home/director/home-frame-resolver";
import { categoryOrbitAngle } from "@/components/public-v2/commerce/category-orbit-geometry";

describe("home cinematic film", () => {
  it("holds the accepted Hero van until the Marketplace plane covers it and reconstructs reverse", () => {
    for (const mode of ["desktop", "mobile"] as const) {
      const terminal = resolveHeroVanFrame(1, mode);
      expect(terminal.visible).toBe(true);
      expect(terminal.opacity).toBe(1);
      expect(terminal.visibleHeightVh).toBe(mode === "desktop" ? 132 : 76);
      expect(resolveHeroVanFrame(.98, mode)).toEqual(resolveHeroVanFrame(.98, mode));
    }
    expect(heroVisibleUnderMarketplace(0)).toBe(true);
    expect(heroVisibleUnderMarketplace(.5)).toBe(true);
    expect(heroVisibleUnderMarketplace(1)).toBe(false);
    expect(heroVisibleUnderMarketplace(.5)).toBe(true);
  });

  it("defines the dedicated pickup chapter, mobile budgets, and settled reduced-motion states", () => {
    expect(HOME_CHAPTERS).toEqual(["hero", "commerce", "parcelization", "pickup", "network", "freight", "last-mile", "finale"]);
    expect(HOME_CHAPTER_BUDGETS_VH.pickup).toBe(190);
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH.pickup).toBe(165);
    for (const chapter of HOME_CHAPTERS.slice(1)) {
      const settled = HOME_REDUCED_MOTION_PROGRESS[chapter];
      expect(settled).toBeGreaterThan(0);
      expect(settled).toBeLessThanOrEqual(1);
      expect(resolveHomeCinematicFrame(chapter, settled, true, 5, 5).chapter).toBe(chapter);
    }
  });

  it("maps every authored physical sequence without overflow, including direct seek", () => {
    expect(HOME_BOX_SEQUENCE).toHaveLength(8);
    expect(HOME_PICKUP_SEQUENCE).toHaveLength(17);
    expect(HOME_DELIVERY_SEQUENCE).toHaveLength(12);
    expect(HOME_HANDOFF_SEQUENCE).toHaveLength(12);
    expect(HOME_RETURN_SEQUENCE).toHaveLength(7);
    expect(HOME_ROUTE_VAN_SEQUENCE).toHaveLength(7);
    expect(sequenceIndex(0, 0, 1, 8)).toBe(0);
    expect(sequenceIndex(1, 0, 1, 8)).toBe(7);
    const samples = Array.from({ length: 101 }, (_, index) => index / 100);
    const pickup = samples.map(pickupFrameIndex);
    expect(pickup).toEqual([...pickup].sort((a, b) => a - b));
    expect(new Set(pickup)).toEqual(new Set(Array.from({ length: 17 }, (_, index) => index)));
    expect(pickup.at(-1)).toBe(16);
    const delivery = samples.map(deliveryFrameIndex);
    expect(delivery).toEqual([...delivery].sort((a, b) => a - b));
    expect(delivery.at(-1)).toBe(11);
    expect(returnFrameIndex(.82)).toBe(0);
    expect(returnFrameIndex(.90)).toBe(4);
    expect(returnFrameIndex(.96)).toBe(6);
    for (const p of samples) {
      const f = resolveHomeCinematicFrame("last-mile", p, false, 5, 5);
      expect(f.handoffIndex).toBeGreaterThanOrEqual(0);
      expect(f.handoffIndex).toBeLessThan(12);
      expect(f.returnIndex).toBeGreaterThanOrEqual(0);
      expect(f.returnIndex).toBeLessThan(7);
    }
  });

  it("follows the approved road, chooses bounded orientation buckets, and anchors the camera", () => {
    const points = Array.from({ length: 101 }, (_, index) => routePoint(index / 100));
    expect(points[0].x).toBeLessThan(0);
    expect(points[43].x).toBeCloseTo(.665, 2);
    expect(points.at(-1)?.y).toBeGreaterThan(1);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].x).toBeGreaterThanOrEqual(points[i - 1].x - .0001);
      expect(points[i].y).toBeGreaterThanOrEqual(points[i - 1].y - .0001);
      const pose = routePose(i / 100);
      expect(pose.bucket % 15).toBe(0);
      expect(Math.abs(pose.residual)).toBeLessThanOrEqual(7.5);
      expect(pose.index).toBeGreaterThanOrEqual(0);
      expect(pose.index).toBeLessThan(HOME_ROUTE_VAN_SEQUENCE.length);
    }
    expect(routePose(.1).bucket).toBe(0);
    expect(routePose(.9).bucket).toBe(90);
    const point = routePoint(.72);
    const camera = routeCamera(point, { width: 1671, height: 941 }, { x: 800, y: 500 }, 1.4);
    expect(camera.x + point.x * 1671 * 1.4).toBeCloseTo(800);
    expect(camera.y + point.y * 941 * 1.4).toBeCloseTo(500);
  });

  it("opens the real product fan without duplication and freezes selection after takeover", () => {
    expect(Array.from({ length: 5 }, (_, index) => categoryOrbitAngle(index, 5))).toEqual([0, 72, 144, 216, 288]);
    for (const count of [1, 2, 5, 9]) {
      const positions = Array.from({ length: count }, (_, index) => index);
      expect(new Set(positions).size).toBe(count);
      expect(selectedProductIndex(count, count - 1, 0)).toBe(count - 1);
      expect(selectedProductIndex(count, 0, .5, count - 1)).toBe(count - 1);
    }
    expect(resolveHomeCinematicFrame("commerce", .04, false, 5, 5).cover).toBeGreaterThan(0);
    expect(resolveHomeCinematicFrame("commerce", .08, false, 5, 5).cover).toBe(1);
    expect(resolveHomeCinematicFrame("commerce", .68, false, 5, 5).motionOwner).toBe("product-fan");
  });

  it("is deterministic for fast forward, reverse, and direct seeks", () => {
    const progresses = [0, .1, .25, .5, .75, .95, 1];
    for (const chapter of HOME_CHAPTERS) {
      const forward = progresses.map((p) => resolveHomeCinematicFrame(chapter, p, false, 5, 7));
      const reverse = [...progresses].reverse().map((p) => resolveHomeCinematicFrame(chapter, p, false, 5, 7)).reverse();
      expect(reverse).toEqual(forward);
      for (let index = 0; index < progresses.length; index++) expect(resolveHomeCinematicFrame(chapter, progresses[index], false, 5, 7)).toEqual(forward[index]);
    }
  });

  it("ships every generated derivative and preserves alpha", async () => {
    expect(HOME_CINEMATIC_ASSETS).toHaveLength(65);
    for (const family of ["pickup", "delivery", "return"]) {
      const frames = HOME_CINEMATIC_ASSETS.filter((asset) => asset.family === family);
      expect(new Set(frames.map((asset) => `${asset.width}x${asset.height}`))).toEqual(new Set(["2048x2048"]));
      expect(frames.some((asset) => asset.sourceWidth === 1254)).toBe(true);
      for (let index = 1; index < frames.length; index++) {
        const previous = frames[index - 1].visibleBounds;
        const current = frames[index].visibleBounds;
        expect(Math.abs((current.x + current.width / 2) / 2048 - (previous.x + previous.width / 2) / 2048)).toBeLessThan(.18);
      }
    }
    for (const asset of HOME_CINEMATIC_ASSETS) {
      expect(asset.hasAlpha).toBe(true);
      expect(asset.aspectRatio).toBeGreaterThan(0);
      for (const url of [asset.desktopSrc, asset.mobileSrc]) {
        const file = path.join(process.cwd(), "public", url.slice(1));
        expect((await stat(file)).size).toBeGreaterThan(0);
        expect((await sharp(file).metadata()).hasAlpha).toBe(true);
      }
    }
  }, 30000);
});
