import { describe, expect, it } from "vitest";
import {
  COURIER_STATES,
  HERO_TRUCK_SEQUENCE,
  RED_TRUCK_STATES,
  VAN_STATES,
  WHITE_TRUCK_STATES,
} from "@/components/public-v3/actors/actor-state-machine";
import {
  assertActorTransition,
  isAdjacentHeroSequenceTransition,
  HOME_ACTOR_TRANSITIONS,
  validateHomeActorTransitions,
} from "@/components/public-v3/home/director/home-actor-transitions";
import { HOME_CHAPTERS, HOME_CHAPTER_BUDGETS_VH, HOME_MOBILE_CHAPTER_BUDGETS_VH, HOME_MOBILE_POLICY } from "@/components/public-v3/home/director/home-chapters";
import { assertPhysicalCoverage, physicalCoverage } from "@/components/public-v3/home/director/home-occlusion";
import { resolveHomeFrame } from "@/components/public-v3/home/director/home-frame-resolver";
import { marketplaceTrackX } from "@/components/public-v3/home/director/home-marketplace-geometry";

const categories = ["grocery", "fashion", "food", "home", "wellness"].map((id) => ({ id }));
const viewportMode = "desktop" as const;
const progressSamples = [0, 0.08, 0.16, 0.29, 0.39, 0.52, 0.66, 0.82, 0.89, 0.95, 0.985, 1];
const stateBanks = {
  whiteTruck: WHITE_TRUCK_STATES,
  van: VAN_STATES,
  courier: COURIER_STATES,
  redTruck: RED_TRUCK_STATES,
};

describe("homepage narrative frame resolver", () => {
  it("resolves the same chapter position to the same complete frame", () => {
    for (const chapter of HOME_CHAPTERS) {
      for (const progress of progressSamples) {
        const input = { chapter, progress, viewportMode, marketplaceCategories: categories };
        const frame = resolveHomeFrame(input);
        expect(resolveHomeFrame(input)).toEqual(frame);

        for (const [name, actor] of Object.entries(frame.actors) as Array<[
          keyof typeof stateBanks,
          (typeof frame.actors)[keyof typeof frame.actors],
        ]>) {
          expect(stateBanks[name]).toHaveProperty(actor.state);
          expect(Number.isFinite(actor.targetX)).toBe(true);
          expect(Number.isFinite(actor.groundY)).toBe(true);
          expect(Number.isFinite(actor.widthVw)).toBe(true);
        }

        const visibleVehicles = [frame.actors.whiteTruck, frame.actors.van, frame.actors.redTruck]
          .filter((actor) => actor.visible);
        expect(visibleVehicles.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("removes generic post-Hero actor covers and keeps Hero sequence validation", () => {
    expect(() => validateHomeActorTransitions()).not.toThrow();
    expect(HOME_ACTOR_TRANSITIONS).toEqual([]);
    expect(isAdjacentHeroSequenceTransition(HERO_TRUCK_SEQUENCE[0], HERO_TRUCK_SEQUENCE[1])).toBe(true);
    expect(isAdjacentHeroSequenceTransition(HERO_TRUCK_SEQUENCE[1], HERO_TRUCK_SEQUENCE[0])).toBe(true);
    expect(isAdjacentHeroSequenceTransition(HERO_TRUCK_SEQUENCE[0], HERO_TRUCK_SEQUENCE[2])).toBe(false);
    expect(() => assertActorTransition("white-truck", HERO_TRUCK_SEQUENCE[0], HERO_TRUCK_SEQUENCE[1], null)).not.toThrow();
    expect(() => assertActorTransition("white-truck", HERO_TRUCK_SEQUENCE[1], HERO_TRUCK_SEQUENCE[0], null)).not.toThrow();
  });

  it("holds one visible courier state through collection and custody", () => {
    for (const chapter of ["collection", "custody"] as const) {
      for (const progress of progressSamples) {
        const frame = resolveHomeFrame({ chapter, progress, viewportMode, marketplaceCategories: categories });
        expect(frame.occlusion.id).toBeNull();
        if (frame.actors.courier.visible) expect(frame.actors.courier.state).toBe("loading-unloading");
      }
    }
  });

  it("uses one Route truck state with monotonic path progress", () => {
    const frames = progressSamples.map((progress) => resolveHomeFrame({ chapter: "route", progress, viewportMode, marketplaceCategories: categories }));
    frames.filter((frame) => frame.actors.whiteTruck.visible).forEach((frame) => {
      expect(frame.actors.whiteTruck.state).toBe("top-down-straight");
      expect(frame.occlusion.id).toBeNull();
    });
    expect(frames.map((frame) => frame.route.pathProgress)).toEqual([...frames.map((frame) => frame.route.pathProgress)].sort((a, b) => a - b));
  });

  it("centers cards using their actual centres without a constant-step drift", () => {
    const centres = [320, 860, 1400, 1940, 2480];
    expect(marketplaceTrackX(centres, 0, 720)).toBe(400);
    expect(marketplaceTrackX(centres, 0.5, 720)).toBe(130);
    expect(marketplaceTrackX(centres, 4, 720)).toBe(-1760);
    expect(marketplaceTrackX(centres, 2.5, 512)).toBe(-1158);
  });

  it("holds each live marketplace category and passes the final visual owner to Fan", () => {
    for (let index = 0; index < categories.length; index += 1) {
      const progress = (index + 0.4) / categories.length;
      const frame = resolveHomeFrame({ chapter: "marketplace", progress, viewportMode, marketplaceCategories: categories });
      expect(frame.marketplace.activeIndex).toBe(index);
      expect(frame.marketplace.activeId).toBe(categories[index]?.id);
      expect(frame.marketplace.holdProgress).toBeGreaterThan(0);
      expect(frame.selection.marketplaceId).toBe(frame.marketplace.activeId);
    }

    const finalMarketplace = resolveHomeFrame({ chapter: "marketplace", progress: 1, viewportMode, marketplaceCategories: categories });
    const deepFanRefresh = resolveHomeFrame({ chapter: "fan", progress: 0.42, viewportMode, marketplaceCategories: categories });
    expect(finalMarketplace.selection.marketplaceId).toBe("wellness");
    expect(deepFanRefresh.selection.marketplaceId).toBe("wellness");
    expect(deepFanRefresh.fan.selectedId).toBe("wellness");
  });

  it("directs the complete V5 truck performance deterministically on desktop and mobile", () => {
    const points = [0, 0.13, 0.18, 0.25, 0.33, 0.4, 0.45, 0.5, 0.58, 0.6, 0.62, 0.7, 0.82, 0.92, 0.975, 1];

    for (const mode of ["desktop", "mobile"] as const) {
      const frames = points.map((progress) => resolveHomeFrame({
        chapter: "hero",
        progress,
        viewportMode: mode,
        marketplaceCategories: categories,
      }));

      points.forEach((progress, index) => {
        const frame = frames[index]!;
        const actor = frame.actors.whiteTruck;
        expect(resolveHomeFrame({ chapter: "hero", progress, viewportMode: mode, marketplaceCategories: categories })).toEqual(frame);
        expect(actor.visible).toBe(progress >= 0.13 && progress < 1);
        expect(frame.world.owner).toBe("hero");
        expect(frame.sceneOwnership.next).toBe("marketplace");
        if (actor.visible) {
          expect(HERO_TRUCK_SEQUENCE).toContain(actor.state);
          expect(actor.sizeMode).toMatchObject({ mode: "visible-height" });
          expect(actor.sizeMode?.mode === "visible-height" ? actor.sizeMode.visibleHeightVh : 0).toBeGreaterThan(0);
          expect(actor.stateBlend ?? 0).toBeGreaterThanOrEqual(0);
          expect(actor.stateBlend ?? 0).toBeLessThanOrEqual(1);
        }
      });

      const reverseFrames = [...points].reverse().map((progress) => resolveHomeFrame({
        chapter: "hero",
        progress,
        viewportMode: mode,
        marketplaceCategories: categories,
      }));
      expect(reverseFrames.reverse()).toEqual(frames);

      const approachFrames = [0.13, 0.18, 0.22, 0.25, 0.33, 0.4].map((progress) =>
        resolveHomeFrame({ chapter: "hero", progress, viewportMode: mode, marketplaceCategories: categories }).actors.whiteTruck,
      );
      for (let index = 1; index < approachFrames.length; index += 1) {
        expect(approachFrames[index]!.targetX).toBeGreaterThanOrEqual(approachFrames[index - 1]!.targetX);
      }
    }

    expect(resolveHomeFrame({ chapter: "hero", progress: 0, viewportMode: "desktop" }).actors.whiteTruck.visible).toBe(false);
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.13, viewportMode: "desktop" }).actors.whiteTruck.state).toBe("front-3q-entry-phase-01");
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.4, viewportMode: "desktop" }).actors.whiteTruck.state).toBe("front-3q-entry-phase-06");
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.54, viewportMode: "desktop" }).actors.whiteTruck.state).toBe("front-center-transition-phase-01");
    const frontalBlendStart = resolveHomeFrame({ chapter: "hero", progress: 0.58, viewportMode: "desktop" }).actors.whiteTruck;
    expect(frontalBlendStart).toMatchObject({
      state: "front-center-transition-phase-02",
      blendToState: "true-front-center-full",
      stateBlend: 0,
    });
    const frontalBlendMiddle = resolveHomeFrame({ chapter: "hero", progress: 0.6, viewportMode: "desktop" }).actors.whiteTruck;
    expect(frontalBlendMiddle.state).toBe("front-center-transition-phase-02");
    expect(frontalBlendMiddle.blendToState).toBe("true-front-center-full");
    expect(frontalBlendMiddle.stateBlend).toBeCloseTo(0.5, 2);
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.62, viewportMode: "desktop" }).actors.whiteTruck.state).toBe("true-front-center-full");
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.7, viewportMode: "desktop" }).actors.whiteTruck.state).toBe("true-front-center-full");
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.82, viewportMode: "desktop" }).actors.whiteTruck.state).toBe("true-front-center-medium");
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.92, viewportMode: "desktop" }).actors.whiteTruck.state).toBe("true-front-center-close");
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.975, viewportMode: "desktop" }).actors.whiteTruck.state).toBe("true-front-center-extreme-close");
    expect(resolveHomeFrame({ chapter: "hero", progress: 1, viewportMode: "desktop" }).actors.whiteTruck.visible).toBe(false);
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.4, viewportMode: "desktop" }).actors.whiteTruck.sizeMode)
      .toMatchObject({ mode: "visible-height", visibleHeightVh: 34 });
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.4, viewportMode: "mobile" }).actors.whiteTruck.sizeMode)
      .toMatchObject({ mode: "visible-height", visibleHeightVh: 36 });
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.4, viewportMode: "mobile" }).actors.whiteTruck.groundY).toBe(0.85);
    expect(resolveHomeFrame({ chapter: "hero", progress: 0.4, viewportMode: "desktop" }).actors.whiteTruck.groundY).toBe(0.88);
  });

  it("locks the frozen V5 Hero states, geometry, and budget at every acceptance point", () => {
    const points = [0, 0.13, 0.22, 0.4, 0.5, 0.58, 0.62, 0.66, 0.78, 0.9, 0.975, 1] as const;
    const expected = {
      desktop: [
        ["front-3q-entry-phase-01", false, -0.26, 22], ["front-3q-entry-phase-01", true, -0.26, 22], ["front-3q-entry-phase-01", true, 0.25, 29], ["front-3q-entry-phase-06", true, 0.5, 34], ["front-3q-entry-phase-06", true, 0.49, 34], ["front-center-transition-phase-02", true, 0.49, 40], ["true-front-center-full", true, 0.4903, 40], ["true-front-center-full", true, 0.491, 40], ["true-front-center-medium", true, 0.4946, 58], ["true-front-center-close", true, 0.4986, 78], ["true-front-center-extreme-close", true, 0.4999, 112], ["true-front-center-extreme-close", false, 0.5, 138],
      ],
      mobile: [
        ["front-3q-entry-phase-01", false, -0.26, 20], ["front-3q-entry-phase-01", true, -0.26, 20], ["front-3q-entry-phase-01", true, 0.25, 24], ["front-3q-entry-phase-06", true, 0.5, 36], ["front-3q-entry-phase-06", true, 0.49, 36], ["front-center-transition-phase-02", true, 0.49, 42], ["true-front-center-full", true, 0.4903, 42], ["true-front-center-full", true, 0.491, 42], ["true-front-center-medium", true, 0.4946, 58], ["true-front-center-close", true, 0.4986, 82], ["true-front-center-extreme-close", true, 0.4999, 112], ["true-front-center-extreme-close", false, 0.5, 124],
      ],
    } as const;

    for (const mode of ["desktop", "mobile"] as const) {
      points.forEach((progress, index) => {
        const [state, visible, targetX, visibleHeightVh] = expected[mode][index]!;
        const actor = resolveHomeFrame({ chapter: "hero", progress, viewportMode: mode, marketplaceCategories: categories }).actors.whiteTruck;
        expect(actor.state).toBe(state);
        expect(actor.visible).toBe(visible);
        expect(actor.targetX).toBeCloseTo(targetX, 3);
        expect(actor.sizeMode).toMatchObject({ mode: "visible-height", visibleHeightVh });
      });
    }
    expect(HOME_CHAPTER_BUDGETS_VH.hero).toBe(205);
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH.hero).toBe(260);
  });

  it("uses a single chapter budget and explicit mobile ownership policy", () => {
    expect(HOME_CHAPTER_BUDGETS_VH).toMatchObject({ marketplace: 300, fan: 150, preparation: 125, collection: 205, custody: 170, route: 235, freight: 190, arrival: 150, finale: 145 });
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH).toMatchObject({ marketplace: 150, fan: 120, preparation: 115, collection: 185, custody: 155, route: 210, freight: 175, arrival: 145, finale: 130 });
    expect(HOME_MOBILE_POLICY).toMatchObject({ marketplace: "native-snap", fan: "document", preparation: "document", collection: "sticky", custody: "sticky", route: "sticky", freight: "sticky", arrival: "sticky", finale: "document" });
  });

  it("resolves the complete mobile V5 hero sequence on the desktop normalized beats", () => {
    const expectedStates: Array<[number, string, string?]> = [
      [0.13, "front-3q-entry-phase-01"],
      [0.18, "front-3q-entry-phase-01"],
      [0.3, "front-3q-entry-phase-03"],
      [0.45, "front-3q-entry-phase-06"],
      [0.55, "front-center-transition-phase-01", "front-center-transition-phase-02"],
      [0.62, "true-front-center-full"],
      [0.72, "true-front-center-full", "true-front-center-medium"],
      [0.84, "true-front-center-medium", "true-front-center-close"],
      [0.94, "true-front-center-close", "true-front-center-extreme-close"],
      [0.98, "true-front-center-extreme-close"],
    ];

    expect(resolveHomeFrame({ chapter: "hero", progress: 0, viewportMode: "mobile" }).actors.whiteTruck.visible).toBe(false);
    for (const [progress, state, blendToState] of expectedStates) {
      const actor = resolveHomeFrame({ chapter: "hero", progress, viewportMode: "mobile" }).actors.whiteTruck;
      expect(actor.visible).toBe(true);
      expect(actor.state).toBe(state);
      if (blendToState) expect(actor.blendToState).toBe(blendToState);
    }
    expect(resolveHomeFrame({ chapter: "hero", progress: 1, viewportMode: "mobile" }).actors.whiteTruck.visible).toBe(false);
  });

  it("keeps freight visible through its climax hold and releases it before Arrival owns the frame", () => {
    const climax = resolveHomeFrame({ chapter: "freight", progress: 0.86, viewportMode, marketplaceCategories: categories });
    expect(climax.actors.redTruck).toMatchObject({ state: "side-right", visible: true });
    const release = resolveHomeFrame({ chapter: "freight", progress: 0.96, viewportMode, marketplaceCategories: categories });
    expect(release.occlusion.id).toBeNull();
    const arrival = resolveHomeFrame({ chapter: "arrival", progress: 0.94, viewportMode, marketplaceCategories: categories });
    expect(arrival.actors.redTruck.visible).toBe(false);
    expect(arrival.actors.courier.visible).toBe(true);
  });

  it("measures coverage from the actor bounding box and rejects insufficient masks", () => {
    const actorRect = { left: 10, top: 10, width: 100, height: 80 };
    expect(physicalCoverage(actorRect, { left: 5, top: 5, width: 110, height: 90 })).toBe(1);
    expect(physicalCoverage(actorRect, { left: 60, top: 10, width: 50, height: 80 })).toBe(0.5);
    expect(() => assertPhysicalCoverage({ actorRect, occluderRect: { left: 60, top: 10, width: 50, height: 80 }, minimumCoverage: 0.85 })).toThrow(/50.0%/);
    expect(assertPhysicalCoverage({ actorRect, occluderRect: { left: 15, top: 12, width: 95, height: 76 }, minimumCoverage: 0.9 })).toBe(0.9025);
  });
});
