import { describe, expect, it } from "vitest";
import { HERO_TRUCK_SEQUENCE, RED_TRUCK_STATES, VAN_STATES, WHITE_TRUCK_STATES } from "@/components/public-v3/actors/actor-state-machine";
import { HOME_BEATS } from "@/components/public-v3/home/director/home-beats";
import {
  HOME_CHAPTERS,
  HOME_CHAPTER_BUDGETS_VH,
  HOME_MOBILE_CHAPTER_BUDGETS_VH,
  HOME_MOBILE_POLICY,
} from "@/components/public-v3/home/director/home-chapters";
import { resolveHeroTruckFrame, routeTruckRotationForTangent } from "@/components/public-v3/home/director/home-frame-resolver";
import { marketplaceTrackX } from "@/components/public-v3/home/director/home-marketplace-geometry";
import {
  JOURNEY_ROAD_OCCLUSION_THRESHOLD,
  POST_HERO_RESOLVER_ACTOR_STATES,
  resolveMarketplaceFrame,
  resolvePostHeroFrame,
  type MotionOwner,
} from "@/components/public-v3/home/director/post-hero-frame-resolver";
import { POST_HERO_ACTOR_ASSETS, postHeroActorsForChapter } from "@/components/public-v3/home/actors/post-hero-actor-preload";
import { POST_HERO_RENDERED_ACTOR_STATES } from "@/components/public-v3/home/actors/PersistentPostHeroCinematicLayer";

const categoryCount = 5;
const samples = [0, 0.08, 0.15, 0.25, 0.34, 0.4, 0.46, 0.55, 0.63, 0.71, 0.76, 0.85, 0.9, 0.95, 1];

describe("canonical home chapter and frame resolver", () => {
  it("keeps the accepted Hero sequence, geometry, and scroll budget", () => {
    expect(HOME_CHAPTERS).toEqual(["hero", "marketplace", "preparation", "journey", "freight", "finale"]);
    expect(HOME_CHAPTER_BUDGETS_VH.hero).toBe(205);
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH.hero).toBe(260);

    const points = [0, 0.13, 0.22, 0.4, 0.5, 0.58, 0.62, 0.66, 0.78, 0.9, 0.975, 1] as const;
    const expectedDesktop = [
      "front-3q-entry-phase-01", "front-3q-entry-phase-01", "front-3q-entry-phase-01", "front-3q-entry-phase-06",
      "front-3q-entry-phase-06", "front-center-transition-phase-02", "true-front-center-full", "true-front-center-full",
      "true-front-center-medium", "true-front-center-close", "true-front-center-extreme-close", "true-front-center-extreme-close",
    ];
    points.forEach((progress, index) => {
      const frame = resolveHeroTruckFrame(progress, "desktop");
      expect(frame.state).toBe(expectedDesktop[index]);
      expect(frame.visible).toBe(progress >= 0.13 && progress < 1);
      expect(resolveHeroTruckFrame(progress, "desktop")).toEqual(frame);
    });
    expect(resolveHeroTruckFrame(0.4, "desktop").sizeMode).toEqual({ mode: "visible-height", visibleHeightVh: 34 });
    expect(resolveHeroTruckFrame(0.4, "mobile")).toMatchObject({ groundY: 0.85, sizeMode: { mode: "visible-height", visibleHeightVh: 36 } });
    expect(HERO_TRUCK_SEQUENCE).toHaveLength(12);
  });

  it("uses the Marketplace rail for traversal, a quiet hold, and one strip exit", () => {
    const start = resolveMarketplaceFrame(0.04, categoryCount);
    const moving = resolveMarketplaceFrame(0.18, categoryCount);
    const hold = resolveMarketplaceFrame(0.28, categoryCount);
    const holdEnd = resolveMarketplaceFrame(0.88, categoryCount);
    const exit = resolveMarketplaceFrame(0.94, categoryCount);
    const handoff = resolveMarketplaceFrame(0.98, categoryCount);
    expect(start.motionOwner).toBe("none");
    expect(moving.motionOwner).toBe("market-rail");
    expect(moving.positionIndex).toBeGreaterThan(0);
    expect(hold.motionOwner).toBe("none");
    expect(holdEnd.motionOwner).toBe("none");
    expect(exit.motionOwner).toBe("market-to-prep-strips");
    expect(handoff.motionOwner).toBe("market-to-prep-strips");
    expect(exit.activeIndex).toBe(4);

    for (let index = 0; index < categoryCount; index += 1) {
      const settledAt = index === 0 ? 0.08 : 0.25 + (index - 1) * 0.18;
      expect(resolveMarketplaceFrame(settledAt, categoryCount).activeIndex).toBe(index);
    }
    expect(HOME_BEATS.marketplace.finalCardHold).toEqual([0.84, 0.9]);
    expect(HOME_BEATS.marketplace.exitSlices).toEqual([0.9, 1]);
  });

  it("renders exactly the persistent Journey and Freight actor inventory", () => {
    expect(new Set(POST_HERO_RENDERED_ACTOR_STATES)).toEqual(new Set(POST_HERO_RESOLVER_ACTOR_STATES));
    POST_HERO_RESOLVER_ACTOR_STATES.forEach((state) => {
      expect(POST_HERO_ACTOR_ASSETS[state].webpSrc).toMatch(/^\/media\/public\/protagonists\/.+\.webp$/);
    });
    expect(POST_HERO_RESOLVER_ACTOR_STATES).toContain("courier:look-right-approach");
    expect(postHeroActorsForChapter("journey")).toContain("courier:look-right-approach");
    expect(postHeroActorsForChapter("journey")).toContain("courier:ready-handover");
    expect(postHeroActorsForChapter("freight")).toContain("white-truck:top-down-straight");
    expect(postHeroActorsForChapter("freight")).toContain("red-truck:side-right");
    expect(POST_HERO_RESOLVER_ACTOR_STATES).toHaveLength(8);
  });

  it("keeps the Journey protagonists present at every authored pickup beat", () => {
    const at = (progress: number) => resolvePostHeroFrame("journey", progress, "desktop");
    [0.1, 0.22, 0.27].forEach((p) => expect(at(p).actors.van.visible).toBe(true));
    expect(at(0.1).actors.van.state).toBe("van:collection-side-right");
    expect(at(0.15).actors.van.xVw).toBeLessThan(at(0.2).actors.van.xVw);
    expect(at(0.35).actors.van.state).toBe("van:collection-door-open-right");
    expect(at(0.44).actors).toMatchObject({
      van: { visible: true, state: "van:collection-door-open-right" },
      courier: { visible: true, state: "courier:look-right-approach" },
    });
    expect(at(0.52).actors.courier.state).toBe("courier:lift-parcel");
    expect(at(0.61).actors.courier.state).toBe("courier:loading-unloading");
    expect(at(0.68).actors).toMatchObject({
      van: { visible: true },
      courier: { visible: true, state: "courier:ready-handover" },
    });
    expect(at(0.81).actors["white-truck"].visible).toBe(false);
    expect(at(0.82).roadReveal).toBeGreaterThanOrEqual(JOURNEY_ROAD_OCCLUSION_THRESHOLD);
    expect(at(0.82).actors["white-truck"]).toMatchObject({ visible: true, state: "white-truck:top-down-straight" });
    expect(at(0.84).actors["white-truck"].visible).toBe(true);
    expect(at(0.93).actors["white-truck"].visible).toBe(true);
    expect(at(0.82).actors.van.visible).toBe(false);
    expect(at(0.82).actors.courier.visible).toBe(false);
    const routeFrames = [0.88, 0.92, 0.96, 1].map(at);
    expect(routeFrames.map((frame) => frame.routeProgress)).toEqual([...routeFrames.map((frame) => frame.routeProgress)].sort((a, b) => a - b));
    expect(VAN_STATES["collection-side-right"].orientation).toBe("right");
    expect(VAN_STATES["collection-door-open-right"].orientation).toBe("right");
    expect(routeTruckRotationForTangent(30)).toBe(210);
    expect(WHITE_TRUCK_STATES["top-down-straight"].orientation).toBe("top-down");
  });

  it("carries the route truck into Freight, then keeps the red truck through services", () => {
    const at = (progress: number) => resolvePostHeroFrame("freight", progress, "desktop");
    expect(at(0.02).actors["white-truck"].visible).toBe(true);
    expect(at(0.12).actors["red-truck"]).toMatchObject({ visible: true, state: "red-truck:side-right" });
    expect(at(0.27).actors["red-truck"].visible).toBe(true);
    expect(at(0.35).actors["red-truck"].visible).toBe(true);
    expect(at(0.48).servicesProgress).toBeGreaterThan(0);
    expect(at(0.48).actors["red-truck"].visible).toBe(true);
    expect(at(0.62).servicesProgress).toBe(1);
    expect(at(0.62).actors["red-truck"].visible).toBe(true);
    expect(at(0.77).actors["red-truck"].xVw).toBeGreaterThan(at(0.62).actors["red-truck"].xVw);
    expect(at(0.85).destinationProgress).toBeGreaterThan(0);
    expect(at(0.85).actors["red-truck"].visible).toBe(false);
    expect(at(0.98).destinationProgress).toBeGreaterThan(0.8);
    expect(RED_TRUCK_STATES["side-right"].orientation).toBe("right");
  });

  it("assigns exactly one primary motion owner and reconstructs arbitrary progress deterministically", () => {
    const allowed: MotionOwner[] = [
      "none", "market-rail", "market-to-prep-strips", "prep-street", "van", "van-door",
      "courier-approach", "courier-lift", "courier-load", "journey-road", "route-truck", "freight-transition",
      "freight-truck", "freight-services", "handoff-takeover", "finale-brand", "finale-utility",
    ];
    const chapterSamples = ["journey", "freight", "finale"] as const;
    for (const chapter of chapterSamples) {
      const frames = samples.map((progress) => resolvePostHeroFrame(chapter, progress, "desktop"));
      frames.forEach((frame, index) => {
        expect(allowed).toContain(frame.motionOwner);
        expect(resolvePostHeroFrame(chapter, samples[index]!, "desktop")).toEqual(frame);
      });
      const reverseFrames = [...samples].reverse().map((progress) => resolvePostHeroFrame(chapter, progress, "desktop"));
      expect(reverseFrames.reverse()).toEqual(frames);
    }
    expect(resolvePostHeroFrame("journey", 0.15, "mobile").actors.van?.widthVw).toBeGreaterThan(100);
    expect(resolvePostHeroFrame("freight", 0.65, "mobile").actors["red-truck"]?.widthVw).toBeGreaterThan(120);
    expect(resolvePostHeroFrame("finale", 0.8, "desktop").motionOwner).toBe("finale-brand");
    expect(resolvePostHeroFrame("finale", 0.91, "desktop").motionOwner).toBe("finale-utility");
    expect(resolvePostHeroFrame("finale", 0.97, "desktop").legalProgress).toBeGreaterThan(0);
  });

  it("uses the productized grouped chapter budgets and native mobile Marketplace policy", () => {
    expect(HOME_CHAPTER_BUDGETS_VH).toMatchObject({ marketplace: 235, preparation: 120, journey: 320, freight: 205, finale: 150 });
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH).toMatchObject({ marketplace: 100, preparation: 105, journey: 290, freight: 210, finale: 150 });
    expect(HOME_MOBILE_POLICY).toMatchObject({ marketplace: "native-snap", preparation: "document", journey: "sticky", freight: "sticky", finale: "sticky" });
  });

  it("centers cards from their measured centres", () => {
    const centres = [320, 860, 1400, 1940, 2480];
    expect(marketplaceTrackX(centres, 0, 720)).toBe(400);
    expect(marketplaceTrackX(centres, 0.5, 720)).toBe(130);
    expect(marketplaceTrackX(centres, 4, 720)).toBe(-1760);
    expect(marketplaceTrackX(centres, 2.5, 512)).toBe(-1158);
  });
});
