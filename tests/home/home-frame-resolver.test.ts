import { describe, expect, it } from "vitest";
import {
  COURIER_STATES,
  RED_TRUCK_STATES,
  VAN_STATES,
  WHITE_TRUCK_STATES,
} from "@/components/public-v3/actors/actor-state-machine";
import {
  assertActorTransition,
  HOME_ACTOR_TRANSITIONS,
  validateHomeActorTransitions,
} from "@/components/public-v3/home/director/home-actor-transitions";
import { HOME_CHAPTERS } from "@/components/public-v3/home/director/home-chapters";
import { assertPhysicalCoverage, physicalCoverage } from "@/components/public-v3/home/director/home-occlusion";
import { resolveHomeFrame } from "@/components/public-v3/home/director/home-frame-resolver";

const categories = ["grocery", "fashion", "food", "home", "wellness"].map((id) => ({ id }));
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
        const input = { chapter, progress, marketplaceCategories: categories };
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

  it("declares each exposed state change with its rendered physical cover", () => {
    expect(() => validateHomeActorTransitions()).not.toThrow();
    expect(HOME_ACTOR_TRANSITIONS.map(({ occlusion }) => occlusion)).toEqual([
      "parcel-mask",
      "parcel-mask",
      "route-overpass-a",
      "route-overpass-b",
      "arrival-architecture-mask",
    ]);

    expect(() => assertActorTransition("courier", "look-left-approach", "lift-parcel", null)).toThrow(/parcel-mask/);
  });

  it("keeps the courier exposed while the named parcel mask covers both pose changes", () => {
    const lift = resolveHomeFrame({ chapter: "collection", progress: 0.76, marketplaceCategories: categories });
    const load = resolveHomeFrame({ chapter: "collection", progress: 0.85, marketplaceCategories: categories });
    expect(lift.actors.courier.state).toBe("lift-parcel");
    expect(lift.actors.courier.visible).toBe(true);
    expect(lift.occlusion).toMatchObject({ id: "parcel-mask", requiredCoverage: 0.9 });
    expect(load.actors.courier.state).toBe("loading-unloading");
    expect(load.actors.courier.visible).toBe(true);
    expect(load.occlusion).toMatchObject({ id: "parcel-mask", requiredCoverage: 0.9 });
  });

  it("keeps route truck orientation changes under named overhead structures", () => {
    const firstSwap = resolveHomeFrame({ chapter: "route", progress: 0.6, marketplaceCategories: categories });
    const angled = resolveHomeFrame({ chapter: "route", progress: 0.64, marketplaceCategories: categories });
    const secondSwap = resolveHomeFrame({ chapter: "route", progress: 0.84, marketplaceCategories: categories });
    expect(firstSwap.actors.whiteTruck).toMatchObject({ state: "top-down-angled", visible: true });
    expect(firstSwap.occlusion).toMatchObject({ id: "route-overpass-a", requiredCoverage: 0.92 });
    expect(angled.actors.whiteTruck).toMatchObject({ state: "top-down-angled", visible: true });
    expect(secondSwap.actors.whiteTruck).toMatchObject({ state: "top-down-turning", visible: true });
    expect(secondSwap.occlusion).toMatchObject({ id: "route-overpass-b", requiredCoverage: 0.92 });
  });

  it("holds each live marketplace category and passes the final visual owner to Fan", () => {
    for (let index = 0; index < categories.length; index += 1) {
      const progress = (index + 0.4) / categories.length;
      const frame = resolveHomeFrame({ chapter: "marketplace", progress, marketplaceCategories: categories });
      expect(frame.marketplace.activeIndex).toBe(index);
      expect(frame.marketplace.activeId).toBe(categories[index]?.id);
      expect(frame.marketplace.holdProgress).toBeGreaterThan(0);
      expect(frame.selection.marketplaceId).toBe(frame.marketplace.activeId);
    }

    const finalMarketplace = resolveHomeFrame({ chapter: "marketplace", progress: 1, marketplaceCategories: categories });
    const deepFanRefresh = resolveHomeFrame({ chapter: "fan", progress: 0.42, marketplaceCategories: categories });
    expect(finalMarketplace.selection.marketplaceId).toBe("wellness");
    expect(deepFanRefresh.selection.marketplaceId).toBe("wellness");
    expect(deepFanRefresh.fan.selectedId).toBe("wellness");
  });

  it("keeps Hero on one side profile through hold and cargo takeover", () => {
    for (const progress of [0.16, 0.29, 0.39, 0.52, 0.66, 0.82, 0.89]) {
      const frame = resolveHomeFrame({ chapter: "hero", progress, marketplaceCategories: categories });
      expect(frame.actors.whiteTruck.state).toBe("side-right");
      expect(frame.actors.whiteTruck.visible).toBe(true);
    }
    const cargo = resolveHomeFrame({ chapter: "hero", progress: 0.89, marketplaceCategories: categories });
    expect(cargo.occlusion).toMatchObject({ id: "hero-cargo-mask", requiredCoverage: 0.9 });
    expect(cargo.world.owner).toBe("hero");
    const takeover = resolveHomeFrame({ chapter: "hero", progress: 0.95, marketplaceCategories: categories });
    expect(takeover.actors.whiteTruck.visible).toBe(false);
    expect(takeover.world.owner).toBe("marketplace");
  });

  it("keeps freight visible through its climax hold and releases it before Arrival owns the frame", () => {
    const climax = resolveHomeFrame({ chapter: "freight", progress: 0.86, marketplaceCategories: categories });
    expect(climax.actors.redTruck).toMatchObject({ state: "side-right", visible: true });
    const release = resolveHomeFrame({ chapter: "freight", progress: 0.96, marketplaceCategories: categories });
    expect(release.occlusion.id).toBe("freight-gate-mask");
    const arrival = resolveHomeFrame({ chapter: "arrival", progress: 0.94, marketplaceCategories: categories });
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
