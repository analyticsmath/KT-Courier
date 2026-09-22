import { describe, expect, it } from "vitest";
import { HERO_TRUCK_SEQUENCE, WHITE_TRUCK_STATES } from "@/components/public-v3/actors/actor-state-machine";
import { POST_HERO_ACTOR_ASSETS, postHeroActorsForChapter } from "@/components/public-v3/home/actors/post-hero-actor-preload";
import { HOME_BEATS } from "@/components/public-v3/home/director/home-beats";
import { HOME_CHAPTERS, HOME_CHAPTER_BUDGETS_VH, HOME_MOBILE_CHAPTER_BUDGETS_VH, HOME_MOBILE_POLICY } from "@/components/public-v3/home/director/home-chapters";
import { resolveHeroTruckFrame, routeTruckRotationForTangent } from "@/components/public-v3/home/director/home-frame-resolver";
import { marketplaceTrackX } from "@/components/public-v3/home/director/home-marketplace-geometry";
import { POST_HERO_RESOLVER_ACTOR_STATES, redTruckViewportX, resolveMarketplaceFrame, resolvePostHeroFrame, type MotionOwner } from "@/components/public-v3/home/director/post-hero-frame-resolver";

describe("post-Hero frame resolver", () => {
  it("protects the accepted Hero sequence and chapter budgets", () => {
    expect(HOME_CHAPTERS).toEqual(["hero", "commerce", "parcelization", "network", "freight", "last-mile", "finale"]);
    expect(HOME_CHAPTER_BUDGETS_VH).toEqual({ hero: 205, commerce: 325, parcelization: 135, network: 280, freight: 215, "last-mile": 340, finale: 150 });
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH).toEqual({ hero: 260, commerce: 250, parcelization: 115, network: 225, freight: 185, "last-mile": 310, finale: 150 });
    expect(HOME_MOBILE_POLICY).toEqual({ hero: "document", commerce: "native-snap", parcelization: "document", network: "sticky", freight: "sticky", "last-mile": "sticky", finale: "sticky" });
    expect(HOME_BEATS.hero.release).toEqual([.975, 1]);
    expect(HERO_TRUCK_SEQUENCE).toHaveLength(12);
    expect(resolveHeroTruckFrame(.4, "desktop").sizeMode).toEqual({ mode: "visible-height", visibleHeightVh: 34 });
  });

  it("resolves continuous Commerce worlds and skips an empty Store World", () => {
    const category = resolveMarketplaceFrame(.2, 5, 0, 5);
    const noStoresProduct = resolveMarketplaceFrame(.7, 5, 0, 5);
    const storeWorld = resolveMarketplaceFrame(.65, 5, 3, 5);
    expect(category.motionOwner).toBe("category-atlas");
    expect(category.positionIndex).toBeGreaterThan(0);
    expect(noStoresProduct.storeIndex).toBe(-1);
    expect(noStoresProduct.motionOwner).toBe("product-fan");
    expect(noStoresProduct.productIndex).toBeGreaterThan(0);
    expect(storeWorld.storeIndex).toBeGreaterThanOrEqual(0);
    expect(storeWorld.motionOwner).toBe("store-index");
    expect(resolveMarketplaceFrame(.99, 5, 3, 5).motionOwner).toBe("selected-product-carry");
  });

  it("keeps the generated post-Hero inventory and nearest-ready chapter tiers", () => {
    expect(POST_HERO_RESOLVER_ACTOR_STATES).toHaveLength(55);
    POST_HERO_RESOLVER_ACTOR_STATES.forEach((state) => expect(POST_HERO_ACTOR_ASSETS[state].webpSrc).toMatch(/\.webp$/));
    expect(postHeroActorsForChapter("network")).toContain("white-truck:top-down-straight");
    expect(postHeroActorsForChapter("freight")).toContain("red-truck:wipe-entry-01");
    expect(postHeroActorsForChapter("last-mile")).toContain("handoff:shared-contact");
  });

  it("keeps custody transfer exclusive and ordered", () => {
    const at = (progress: number) => resolvePostHeroFrame("last-mile", progress, "desktop");
    expect(at(.35).actors.van.state).toContain("door-open");
    expect(at(.46).actors.courier.visible).toBe(true);
    expect(at(.55).actors.recipient.visible).toBe(true);
    expect(at(.72).actors.handoff.visible).toBe(true);
    expect(at(.72).actors.courier.visible).toBe(false);
    expect(at(.72).actors.recipient.visible).toBe(false);
    expect(at(.82).actors.handoff.state).toBe("handoff:separation");
    expect(at(.85).actors.recipient.state).toBe("recipient:after-receive");
    expect(at(.9).actors.courier.state).toContain("return-right");
    expect(at(.95).actors.van.state).toContain("door-close");
    expect(at(.99).actors.van.state).toContain("departure");
  });

  it("preserves White Truck route states and tangent-derived orientation", () => {
    expect(resolvePostHeroFrame("network", .2, "desktop").actors["white-truck"].state).toBe("white-truck:top-down-straight");
    expect(resolvePostHeroFrame("network", .52, "desktop").actors["white-truck"].state).toBe("white-truck:top-down-angled");
    expect(resolvePostHeroFrame("network", .78, "desktop").actors["white-truck"].state).toBe("white-truck:top-down-turning");
    expect(routeTruckRotationForTangent(30)).toBe(210);
    expect(WHITE_TRUCK_STATES["top-down-turning"].orientation).toBe("top-down");
  });

  it("makes the Red Truck a physical right-to-left viewport wipe", () => {
    const points = [.07, .22, .3, .54, .61, .75, .87, .96, 1].map(redTruckViewportX);
    expect(points).toEqual([...points].sort((a, b) => b - a));
    expect(points[0]).toBe(120);
    expect(points[3]).toBeCloseTo(42, 0);
    expect(points[6]).toBeLessThan(0);
    expect(points.at(-1)).toBe(-75);
    expect(resolvePostHeroFrame("freight", .65, "mobile").actors["red-truck"].size.valueVw).toBeGreaterThan(120);
  });

  it("reconstructs each frame deterministically with one motion owner", () => {
    const allowed: MotionOwner[] = ["none", "commerce-aperture", "category-atlas", "store-index", "product-fan", "selected-product-carry", "packaging", "label-route", "route-truck", "route-camera-seam", "red-truck", "red-trailer-takeover", "van", "van-door", "courier", "recipient", "handoff", "van-return", "finale-brand", "finale-utility"];
    for (const chapter of ["commerce", "parcelization", "network", "freight", "last-mile", "finale"] as const) {
      for (const progress of [0, .2, .5, .72, .9, 1]) {
        const frame = resolvePostHeroFrame(chapter, progress, "desktop");
        expect(allowed).toContain(frame.motionOwner);
        expect(resolvePostHeroFrame(chapter, progress, "desktop")).toEqual(frame);
      }
    }
  });

  it("centers measured card centres instead of assuming a card step", () => {
    const centres = [320, 860, 1400, 1940, 2480];
    expect(marketplaceTrackX(centres, 0, 720)).toBe(400);
    expect(marketplaceTrackX(centres, 0.5, 720)).toBe(130);
    expect(marketplaceTrackX(centres, 4, 720)).toBe(-1760);
  });
});
