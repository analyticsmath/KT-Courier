import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { HERO_VAN_BASELINE_Y, HERO_VAN_CANVAS_ASPECT, HERO_VAN_FRAMES, HERO_VAN_SEQUENCE, HERO_VAN_VISIBLE_CENTER_X, HERO_VAN_VISIBLE_HEIGHT_RATIO } from "@/components/public-v3/home/director/hero-van-sequence.generated";
import { heroVanBlendWeights, resolveHeroVanFrame } from "@/components/public-v3/home/director/home-frame-resolver";
import { range, smooth } from "@/components/public-v3/home/director/home-beats";

describe("hero van motion correction", () => {
  const at = (progress: number, mode: "mobile" | "desktop" = "desktop") => resolveHeroVanFrame(progress, mode);

  it("traverses all yaw states in order and holds true front through release", () => {
    expect(at(.12).visible).toBe(false);
    expect(at(.2).state).toBe("yaw-000");
    expect(at(.24).state).toBe("yaw-000");
    expect(at(.66).state).toBe("yaw-090");
    const frames = Array.from({ length: 1001 }, (_, index) => at(index / 1000));
    expect([...new Set(frames.map((frame) => frame.state))]).toEqual(HERO_VAN_SEQUENCE);
    const indices = frames.map((frame) => HERO_VAN_SEQUENCE.indexOf(frame.state));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    for (const progress of [.66, .73, .85, .92, .97, .99, 1]) expect(at(progress).state).toBe("yaw-090");
    expect(HERO_VAN_FRAMES).toHaveLength(19);
  });

  it("caps whole-van size, holds it, then recedes and fades", () => {
    for (const mode of ["desktop", "mobile"] as const) {
      const frames = Array.from({ length: 1001 }, (_, index) => at(index / 1000, mode));
      const cap = mode === "mobile" ? 76 : 80;
      expect(Math.max(...frames.map((frame) => frame.visibleHeightVh))).toBe(cap);
      expect(cap).toBeGreaterThan(mode === "mobile" ? 70 : 72);
      expect(at(.92, mode).visibleHeightVh).toBeGreaterThan(at(.73, mode).visibleHeightVh);
      expect(at(.92, mode).visibleHeightVh).toBe(at(.96, mode).visibleHeightVh);
      expect(at(.96, mode).phase).toBe("hold");
      expect(at(.97, mode).phase).toBe("release");
      expect(at(1, mode).visibleHeightVh).toBeLessThan(at(.97, mode).visibleHeightVh);
      expect(at(.96, mode).opacity).toBe(1);
      expect(at(.985, mode).opacity).toBeLessThan(at(.97, mode).opacity);
      expect(at(1, mode).opacity).toBe(0);
      for (const progress of [.73, .82, .92, .96, .97, 1]) {
        const frame = at(progress, mode);
        expect(frame.anchorMode).toBe("center");
        expect(frame.visibleCenterY - frame.visibleHeightVh / 200).toBeGreaterThan(0);
        expect(frame.visibleCenterY + frame.visibleHeightVh / 200).toBeLessThan(1);
      }
      expect(at(.92, mode).visibleCenterY).toBe(mode === "mobile" ? .57 : .58);
      expect(at(.92, mode).visibleCenterY).toBeGreaterThan(.52);
    }
    expect(at(.2).anchorMode).toBe("ground");
    expect(at(.4).anchorMode).toBe("ground");
    expect(at(.68).anchorMode).toBe("transition");
    expect(at(.66).anchorBlend).toBe(0);
    expect(at(.73).anchorBlend).toBe(1);
    expect(at(.8).targetCenterX).toBe(.5);
  });

  it("uses only a short adjacent boundary blend and reconstructs reverse seeks", () => {
    const samples = Array.from({ length: 1001 }, (_, index) => index / 1000);
    const forward = new Map(samples.map((progress) => [progress, at(progress)]));
    let hasExtendedBlend = false;
    for (const progress of samples) {
      const desktop = at(progress);
      const mobile = at(progress, "mobile");
      expect(mobile.state).toBe(desktop.state);
      expect(mobile.blendToState).toBe(desktop.blendToState);
      if (desktop.blendToState) expect(HERO_VAN_SEQUENCE.indexOf(desktop.blendToState)).toBe(HERO_VAN_SEQUENCE.indexOf(desktop.state) + 1);
      const position = smooth(range(progress, .24, .66)) * 18;
      const fraction = position - Math.floor(position);
      if (fraction < .68) expect(desktop.stateBlend).toBe(0);
      if (desktop.phase === "turn" && fraction > .7 && fraction < .78 && desktop.stateBlend > 0) hasExtendedBlend = true;
      expect(at(progress)).toEqual(desktop);
    }
    expect(hasExtendedBlend).toBe(true);
    expect(heroVanBlendWeights(0)).toEqual({ current: 1, next: 0 });
    expect(heroVanBlendWeights(1).current).toBeCloseTo(0);
    expect(heroVanBlendWeights(1).next).toBeCloseTo(1);
    expect(heroVanBlendWeights(.5).current).toBeCloseTo(Math.SQRT1_2);
    expect(heroVanBlendWeights(.5).next).toBeCloseTo(Math.SQRT1_2);
    for (const progress of samples.reverse()) expect(at(progress)).toEqual(forward.get(progress));
    expect(at(.24).targetCenterX).toBeLessThan(at(.45).targetCenterX);
    expect(at(.45).targetCenterX).toBeLessThan(at(.66).targetCenterX);
  });

  it("serves normalized 4:3 derivatives with a shared alpha baseline", async () => {
    expect(HERO_VAN_CANVAS_ASPECT).toBeCloseTo(4 / 3);
    expect(HERO_VAN_VISIBLE_CENTER_X).toBe(.5);
    expect(HERO_VAN_VISIBLE_HEIGHT_RATIO).toBeGreaterThan(.5);
    const bounds = await Promise.all(HERO_VAN_FRAMES.map(async (frame) => {
      const path = join(process.cwd(), "public", frame.desktopSrc.slice(1));
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let left = info.width;
      let right = -1;
      let top = info.height;
      let bottom = -1;
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          if (data[(y * info.width + x) * info.channels + 3] >= 8) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      }
      return { left, right, top, bottom, width: info.width, height: info.height };
    }));
    expect(Math.max(...bounds.map((b) => b.bottom)) - Math.min(...bounds.map((b) => b.bottom))).toBeLessThanOrEqual(1);
    expect(Math.max(...bounds.map((b) => b.bottom - b.top)) - Math.min(...bounds.map((b) => b.bottom - b.top))).toBeLessThanOrEqual(1);
    bounds.forEach((b) => expect(Math.abs((b.left + b.right) / 2 - b.width / 2)).toBeLessThanOrEqual(1));
    expect(bounds[0].bottom / bounds[0].height).toBeCloseTo(HERO_VAN_BASELINE_Y, 2);
  });
});
