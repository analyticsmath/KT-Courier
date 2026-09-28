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
    for (const progress of [.66, .72, .85, .9, .965, .995, 1]) expect(at(progress).state).toBe("yaw-090");
    expect(HERO_VAN_FRAMES).toHaveLength(19);
  });

  it("keeps advancing through the desktop camera pass and fades only during final clear", () => {
    const frames = Array.from({ length: 281 }, (_, index) => at(.72 + index / 1000));
    for (let index = 1; index < frames.length; index++) {
      expect(frames[index].visibleHeightVh).toBeGreaterThanOrEqual(frames[index - 1].visibleHeightVh);
    }
    expect(at(.72).visibleHeightVh).toBe(62);
    expect(at(.9).visibleHeightVh).toBe(88);
    expect(at(.96).visibleHeightVh).toBeGreaterThan(100);
    expect(at(.965).visibleHeightVh).toBe(108);
    expect(at(.995).visibleHeightVh).toBe(132);
    expect(at(1).visibleHeightVh).toBe(138);
    expect(at(.9).phase).toBe("deep-approach");
    expect(at(.965).phase).toBe("camera-pass");
    expect(at(.995).phase).toBe("final-clear");
    expect(new Set(frames.map((frame) => frame.phase))).not.toContain("release");
    for (const progress of [.72, .9, .965, .994, .995]) expect(at(progress).opacity).toBe(1);
    expect(at(.9975).opacity).toBeCloseTo(.5);
    expect(at(1).opacity).toBe(0);
    for (const progress of [.72, .8, .9, .94, .965, .98, .995, 1]) {
      expect(at(progress).anchorMode).toBe("center");
      expect(at(progress).anchorBlend).toBe(1);
    }
    expect(at(.72).visibleCenterY).toBe(.58);
    expect(at(.9).visibleCenterY).toBe(.585);
    expect(at(.965).visibleCenterY).toBe(.59);
    expect(at(.995).visibleCenterY).toBe(.62);
    expect(at(1).visibleCenterY).toBe(.625);
    expect(at(.8).targetCenterX).toBe(.5);
  });

  it("preserves the mobile whole-van approach and its existing release", () => {
    const mobile = (progress: number) => at(progress, "mobile");
    expect(mobile(.73).visibleHeightVh).toBe(60);
    expect(mobile(.92).visibleHeightVh).toBe(76);
    expect(mobile(.96).visibleHeightVh).toBe(76);
    expect(mobile(.96).phase).toBe("hold");
    expect(mobile(.97).phase).toBe("release");
    expect(mobile(1).visibleHeightVh).toBe(66);
    expect(mobile(.985).opacity).toBeLessThan(1);
    expect(mobile(1).opacity).toBe(0);
    expect(mobile(.995).visibleHeightVh).toBeLessThan(100);
    for (const progress of [.73, .82, .92, .96, .97, 1]) {
      const frame = mobile(progress);
      expect(frame.anchorMode).toBe("center");
      expect(frame.visibleCenterY - frame.visibleHeightVh / 200).toBeGreaterThan(0);
      expect(frame.visibleCenterY + frame.visibleHeightVh / 200).toBeLessThan(1);
    }
    expect(mobile(.92).visibleCenterY).toBe(.57);
    expect(at(.2).anchorMode).toBe("ground");
    expect(at(.4).anchorMode).toBe("ground");
    expect(at(.68).anchorMode).toBe("transition");
    expect(at(.66).anchorBlend).toBe(0);
    expect(at(.72).anchorBlend).toBe(1);
    expect(mobile(.73).anchorBlend).toBe(1);
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
