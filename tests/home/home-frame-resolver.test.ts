import { describe, expect, it } from "vitest";
import {
  COURIER_STATES,
  RED_TRUCK_STATES,
  VAN_STATES,
  WHITE_TRUCK_STATES,
} from "@/components/public-v3/actors/actor-state-machine";
import { validateHomeActorTransitions } from "@/components/public-v3/home/director/home-actor-transitions";
import { HOME_CHAPTERS } from "@/components/public-v3/home/director/home-chapters";
import { resolveHomeFrame } from "@/components/public-v3/home/director/home-frame-resolver";

const categories = ["grocery", "fashion", "food", "home", "wellness"].map((id) => ({ id }));
const progressSamples = [0, 0.2, 0.36, 0.46, 0.65, 0.8, 0.9, 0.97, 1];

describe("homepage narrative frame resolver", () => {
  it("resolves identical chapter positions to identical frames with valid mounted actor states", () => {
    const stateBanks = {
      whiteTruck: WHITE_TRUCK_STATES,
      van: VAN_STATES,
      courier: COURIER_STATES,
      redTruck: RED_TRUCK_STATES,
    };

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

  it("honors every declared actor transition chain and concealment requirement", () => {
    expect(() => validateHomeActorTransitions()).not.toThrow();
  });

  it("keeps the courier hidden while collection states change under parcel coverage", () => {
    const lift = resolveHomeFrame({ chapter: "collection", progress: 0.76, marketplaceCategories: categories });
    const loadCovered = resolveHomeFrame({ chapter: "collection", progress: 0.84, marketplaceCategories: categories });
    const loadRevealed = resolveHomeFrame({ chapter: "collection", progress: 0.85, marketplaceCategories: categories });

    expect(lift.actors.courier.state).toBe("lift-parcel");
    expect(lift.actors.courier.visible).toBe(false);
    expect(lift.transition.occlusion).toBe("van-door");
    expect(loadCovered.actors.courier.state).toBe("loading-unloading");
    expect(loadCovered.actors.courier.visible).toBe(false);
    expect(loadCovered.transition.occlusion).toBe("parcel-coverage");
    expect(loadRevealed.actors.courier.visible).toBe(true);
  });

  it("conceals route orientation changes and releases the route actor before freight", () => {
    const firstSwap = resolveHomeFrame({ chapter: "route", progress: 0.6, marketplaceCategories: categories });
    const angled = resolveHomeFrame({ chapter: "route", progress: 0.64, marketplaceCategories: categories });
    const secondSwap = resolveHomeFrame({ chapter: "route", progress: 0.84, marketplaceCategories: categories });

    expect(firstSwap.actors.whiteTruck.state).toBe("top-down-angled");
    expect(firstSwap.actors.whiteTruck.visible).toBe(false);
    expect(firstSwap.transition.occlusion).toBe("overpass-shadow");
    expect(angled.actors.whiteTruck.visible).toBe(true);
    expect(secondSwap.actors.whiteTruck.state).toBe("top-down-turning");
    expect(secondSwap.actors.whiteTruck.visible).toBe(false);
  });

  it("provides a readable hold for each live marketplace category", () => {
    for (let index = 0; index < categories.length; index += 1) {
      const progress = (index + 0.4) / categories.length;
      const frame = resolveHomeFrame({ chapter: "marketplace", progress, marketplaceCategories: categories });
      expect(frame.marketplace.activeIndex).toBe(index);
      expect(frame.marketplace.activeId).toBe(categories[index]?.id);
      expect(frame.marketplace.holdProgress).toBeGreaterThan(0);
    }
  });

  it("holds the hero truck at the same grounded coordinate throughout the reading hold", () => {
    const earlyHold = resolveHomeFrame({ chapter: "hero", progress: 0.36, marketplaceCategories: categories });
    const lateHold = resolveHomeFrame({ chapter: "hero", progress: 0.51, marketplaceCategories: categories });
    expect(earlyHold.actors.whiteTruck.visible).toBe(true);
    expect(lateHold.actors.whiteTruck.visible).toBe(true);
    expect(earlyHold.actors.whiteTruck.targetX).toBe(lateHold.actors.whiteTruck.targetX);
    expect(earlyHold.actors.whiteTruck.groundY).toBe(lateHold.actors.whiteTruck.groundY);
  });

  it("covers the route truck before releasing it into the freight world", () => {
    const overlap = resolveHomeFrame({ chapter: "route", progress: 0.97, marketplaceCategories: categories });
    const covered = resolveHomeFrame({ chapter: "route", progress: 0.98, marketplaceCategories: categories });
    expect(overlap.transition.occlusion).toBe("road-geometry");
    expect(overlap.actors.whiteTruck.visible).toBe(true);
    expect(covered.transition.progress).toBe(1);
    expect(covered.actors.whiteTruck.visible).toBe(false);
  });
});
