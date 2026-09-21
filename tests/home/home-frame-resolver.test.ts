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
  POST_HERO_RESOLVER_ACTOR_STATES,
  resolveMarketplaceFrame,
  resolvePostHeroFrame,
  type MotionOwner,
} from "@/components/public-v3/home/director/post-hero-frame-resolver";
import { POST_HERO_ACTOR_ASSETS, postHeroActorsForChapter } from "@/components/public-v3/home/actors/post-hero-actor-preload";
import { POST_HERO_RENDERED_ACTOR_STATES } from "@/components/public-v3/home/actors/PostHeroActorSprite";

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

  it("uses the Marketplace rail for category travel, then one portal and one exit transition", () => {
    const start = resolveMarketplaceFrame(0.04, categoryCount);
    const moving = resolveMarketplaceFrame(0.18, categoryCount);
    const hold = resolveMarketplaceFrame(0.28, categoryCount);
    const portal = resolveMarketplaceFrame(0.88, categoryCount);
    const exit = resolveMarketplaceFrame(0.93, categoryCount);
    const handoff = resolveMarketplaceFrame(0.98, categoryCount);
    expect(start.motionOwner).toBe("none");
    expect(moving.motionOwner).toBe("market-rail");
    expect(moving.positionIndex).toBeGreaterThan(0);
    expect(hold.motionOwner).toBe("none");
    expect(portal.motionOwner).toBe("market-portal");
    expect(exit.motionOwner).toBe("market-exit-slices");
    expect(handoff.motionOwner).toBe("prep-media");
    expect(exit.activeIndex).toBe(4);

    for (let index = 0; index < categoryCount; index += 1) {
      const settledAt = index === 0 ? 0.08 : 0.25 + (index - 1) * 0.18;
      expect(resolveMarketplaceFrame(settledAt, categoryCount).activeIndex).toBe(index);
    }
    expect(HOME_BEATS.marketplace.portalBuild).toEqual([0.84, 0.875]);
    expect(HOME_BEATS.marketplace.portalHold).toEqual([0.875, 0.91]);
    expect(HOME_BEATS.marketplace.exitSlices).toEqual([0.91, 0.955]);
    expect(HOME_BEATS.marketplace.mediaHandoff).toEqual([0.955, 1]);
  });

  it("renders every actor state the Journey, Freight, and Finale resolver can request", () => {
    expect(new Set(POST_HERO_RENDERED_ACTOR_STATES)).toEqual(new Set(POST_HERO_RESOLVER_ACTOR_STATES));
    POST_HERO_RESOLVER_ACTOR_STATES.forEach((state) => {
      expect(POST_HERO_ACTOR_ASSETS[state].webpSrc).toMatch(/^\/media\/public\/protagonists\/.+\.webp$/);
    });
    expect(POST_HERO_RESOLVER_ACTOR_STATES).toContain("courier:look-right-approach");
    expect(POST_HERO_RESOLVER_ACTOR_STATES).toContain("courier:extending-handoff");
    expect(postHeroActorsForChapter("journey")).toContain("courier:look-right-approach");
    expect(postHeroActorsForChapter("freight")).toContain("white-truck:top-down-straight");
    expect(postHeroActorsForChapter("freight")).toContain("red-truck:side-right");
    expect(postHeroActorsForChapter("finale")).toEqual(["courier:extending-handoff"]);
  });

  it("keeps the journey actors visible through pickup, custody, and road takeover", () => {
    const at = (progress: number) => resolvePostHeroFrame("journey", progress, "desktop");
    expect(at(0.15).actors.van).toMatchObject({ visible: true, state: "van:collection-side-right" });
    expect(at(0.2).actors.van!.xVw).toBeGreaterThan(at(0.15).actors.van!.xVw);
    expect(at(0.34).actors.van).toMatchObject({ visible: true, state: "van:collection-side-right" });
    expect(at(0.46).actors.van).toMatchObject({ visible: true, state: "van:collection-door-open-right" });
    expect(at(0.55).actors.courier?.state).toBe("courier:look-right-approach");
    expect(at(0.63).actors.courier?.state).toBe("courier:lift-parcel");
    expect(at(0.71).actors.courier?.state).toBe("courier:loading-unloading");
    expect(at(0.76).actors.courier?.state).toBe("courier:ready-handover");
    expect(at(0.85).roadReveal).toBeGreaterThan(0.4);
    expect(at(0.85).actors.van?.visible).toBe(true);
    expect(at(0.95).actors.van).toBeUndefined();
    expect(at(0.95).actors["white-truck"]?.state).toBe("white-truck:top-down-straight");
    const routeFrames = [0.92, 0.95, 0.98, 1].map(at);
    expect(routeFrames.map((frame) => frame.routeProgress)).toEqual([...routeFrames.map((frame) => frame.routeProgress)].sort((a, b) => a - b));
    expect(VAN_STATES["collection-side-right"].orientation).toBe("right");
    expect(VAN_STATES["collection-door-open-right"].orientation).toBe("right");
    expect(routeTruckRotationForTangent(30)).toBe(210);
    expect(WHITE_TRUCK_STATES["top-down-straight"].orientation).toBe("top-down");
  });

  it("keeps the freight truck present while the service field rises, then hands off to a real destination", () => {
    const at = (progress: number) => resolvePostHeroFrame("freight", progress, "desktop");
    expect(at(0.15).actors["red-truck"]?.visible).toBe(true);
    expect(at(0.37).actors["red-truck"]).toMatchObject({ visible: true, state: "red-truck:side-right" });
    expect(at(0.5).servicesProgress).toBeGreaterThan(0);
    expect(at(0.65).servicesProgress).toBe(1);
    expect(at(0.65).actors["red-truck"]?.visible).toBe(true);
    expect(at(0.78).actors["red-truck"]!.xVw).toBeGreaterThan(at(0.65).actors["red-truck"]!.xVw);
    expect(at(0.92).destinationProgress).toBeGreaterThan(0);
    expect(at(0.92).actors["red-truck"]?.visible).toBe(true);
    expect(at(0.98).destinationProgress).toBeGreaterThan(0.8);
    expect(RED_TRUCK_STATES["side-right"].orientation).toBe("right");
  });

  it("assigns exactly one primary motion owner and reconstructs arbitrary progress deterministically", () => {
    const allowed: MotionOwner[] = [
      "none", "market-rail", "market-portal", "market-exit-slices", "prep-media", "van", "van-door",
      "courier-approach", "courier-lift", "journey-road", "route-truck", "freight-truck", "freight-services",
      "destination-takeover", "arrival-courier", "finale-brand", "finale-utility",
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
    expect(resolvePostHeroFrame("finale", 0.87, "desktop").motionOwner).toBe("finale-utility");
    expect(resolvePostHeroFrame("finale", 0.95, "desktop").legalProgress).toBeGreaterThan(0);
  });

  it("uses the productized grouped chapter budgets and native mobile Marketplace policy", () => {
    expect(HOME_CHAPTER_BUDGETS_VH).toMatchObject({ marketplace: 235, preparation: 120, journey: 320, freight: 205, finale: 150 });
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH).toMatchObject({ marketplace: 100, preparation: 105, journey: 260, freight: 208, finale: 150 });
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
