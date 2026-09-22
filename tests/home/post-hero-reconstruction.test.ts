import { describe, expect, it } from "vitest";
import { GENERATED_ACTOR_STATES } from "@/components/public-v3/actors/generated-actor-media";
import { computePostHeroActorBox } from "@/components/public-v3/home/director/post-hero-actor-geometry";
import { getCommerceBeats } from "@/components/public-v3/home/director/home-beats";
import { resolvePostHeroFrame, resolveSelectedProductId } from "@/components/public-v3/home/director/post-hero-frame-resolver";

describe("post-Hero reconstruction invariants", () => {
  it("treats generated visible bounds as normalized ratios", () => {
    const van = GENERATED_ACTOR_STATES["van:delivery-entry-01"]!;
    const box = computePostHeroActorBox({ viewportWidth: 1440, viewportHeight: 900, actor: van, size: { mode: "visible-width", valueVw: 58 }, anchor: { xVw: 72, yVh: 87 } });
    expect(box.visibleWidth).toBeCloseTo(835.2, 1);
    expect(box.width).toBeLessThan(1000);
    expect(box.width).toBeGreaterThan(800);
  });

  it("keeps visible-height actor sizing within the viewport scale", () => {
    const courier = GENERATED_ACTOR_STATES["courier:delivery-hold"]!;
    const box = computePostHeroActorBox({ viewportWidth: 1440, viewportHeight: 900, actor: courier, size: { mode: "visible-height", valueVh: 60 }, anchor: { xVw: 62, yVh: 87 } });
    expect(box.visibleHeight).toBeCloseTo(540, 1);
    expect(box.height).toBeLessThan(900);
    expect(box.height).toBeGreaterThan(500);
  });

  it("freezes the selected product once the takeover begins", () => {
    const ids = ["a", "b", "c"];
    expect(resolveSelectedProductId(ids, .75, 0)).toBe("b");
    expect(resolveSelectedProductId(ids, .95, 0, "b")).toBe("b");
    expect(resolveSelectedProductId(ids, .95, 0)).toBe("c");
  });

  it("blends only adjacent van door states and keeps custody exclusive", () => {
    const van = resolvePostHeroFrame("last-mile", .37, "desktop").actors.van;
    expect(van.state).toContain("door-open");
    expect(van.blendToState).toBeDefined();
    const handoff = resolvePostHeroFrame("last-mile", .72, "desktop").actors;
    expect(handoff.handoff.visible).toBe(true);
    expect(handoff.courier.visible).toBe(false);
    expect(handoff.recipient.visible).toBe(false);
  });

  it("keeps mobile actor geometry authored independently", () => {
    const desktop = resolvePostHeroFrame("last-mile", .24, "desktop").actors.van.size;
    const mobile = resolvePostHeroFrame("last-mile", .24, "mobile").actors.van.size;
    expect(desktop).toEqual({ mode: "visible-width", valueVw: 56 });
    expect(mobile).toEqual({ mode: "visible-width", valueVw: 124 });
  });

  it("keeps reduced-motion stills in readable holds", () => {
    expect(getCommerceBeats(0).selectedTakeover[0]).toBe(.91);
    expect(resolvePostHeroFrame("network", .78, "desktop").actors["white-truck"].visible).toBe(true);
    expect(resolvePostHeroFrame("freight", .35, "desktop").actors["red-truck"].state).toBe("red-truck:wipe-side-full");
    expect(resolvePostHeroFrame("last-mile", .77, "desktop").actors.handoff.visible).toBe(true);
  });
});
