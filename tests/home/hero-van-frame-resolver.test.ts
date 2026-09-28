import { describe, expect, it } from "vitest";
import { HERO_VAN_SEQUENCE } from "@/components/public-v3/home/director/hero-van-sequence.generated";
import { resolveHeroVanFrame } from "@/components/public-v3/home/director/home-frame-resolver";

describe("hero van progress resolver", () => {
  it("holds the side entry, traverses all 19 ordered yaw frames, then scales true front", () => {
    expect(resolveHeroVanFrame(.12, "desktop").visible).toBe(false);
    expect(resolveHeroVanFrame(.18, "desktop").state).toBe("yaw-000");
    expect(resolveHeroVanFrame(.22, "desktop").state).toBe("yaw-000");
    expect(resolveHeroVanFrame(.66, "desktop").state).toBe("yaw-090");
    const frames = Array.from({ length: 1001 }, (_, index) => resolveHeroVanFrame(index / 1000, "desktop"));
    const visited = [...new Set(frames.map((frame) => frame.state))];
    expect(visited).toEqual(HERO_VAN_SEQUENCE);
    expect(frames.map((frame) => HERO_VAN_SEQUENCE.indexOf(frame.state))).toEqual(
      [...frames.map((frame) => HERO_VAN_SEQUENCE.indexOf(frame.state))].sort((a, b) => a - b),
    );
    for (const progress of [.66, .7, .8, .9, .975, 1]) expect(resolveHeroVanFrame(progress, "desktop").state).toBe("yaw-090");
    expect(resolveHeroVanFrame(.9, "desktop").canvasScale).toBeGreaterThan(resolveHeroVanFrame(.7, "desktop").canvasScale);
  });

  it("blends only neighboring states and reconstructs reverse progress exactly", () => {
    for (let index = 0; index <= 1000; index++) {
      const progress = index / 1000;
      const desktop = resolveHeroVanFrame(progress, "desktop");
      const mobile = resolveHeroVanFrame(progress, "mobile");
      expect(mobile.state).toBe(desktop.state);
      expect(mobile.blendToState).toBe(desktop.blendToState);
      if (desktop.blendToState) expect(HERO_VAN_SEQUENCE.indexOf(desktop.blendToState)).toBe(HERO_VAN_SEQUENCE.indexOf(desktop.state) + 1);
      expect(resolveHeroVanFrame(progress, "desktop")).toEqual(desktop);
    }
    const start = resolveHeroVanFrame(.22, "desktop").targetX;
    const middle = resolveHeroVanFrame(.44, "desktop").targetX;
    const end = resolveHeroVanFrame(.66, "desktop").targetX;
    expect(start).toBeLessThan(middle);
    expect(middle).toBeLessThan(end);
    expect(end).toBe(.5);
  });
});
