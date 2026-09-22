import { describe, expect, it } from "vitest";
import { GENERATED_ACTOR_STATES } from "@/components/public-v3/actors/generated-actor-media";
import { POST_HERO_RESOLVER_ACTOR_STATES, resolvePostHeroFrame } from "@/components/public-v3/home/director/post-hero-frame-resolver";
import { HOME_BEATS } from "@/components/public-v3/home/director/home-beats";
import { HOME_CHAPTERS, HOME_CHAPTER_BUDGETS_VH, HOME_MOBILE_CHAPTER_BUDGETS_VH, HOME_MOBILE_POLICY } from "@/components/public-v3/home/director/home-chapters";

describe("post-Hero homepage rebuild contract", () => {
  it("keeps the accepted Hero and exact post-Hero chapter budgets", () => {
    expect(HOME_CHAPTERS).toEqual(["hero", "commerce", "parcelization", "network", "freight", "last-mile", "finale"]);
    expect(HOME_CHAPTER_BUDGETS_VH).toEqual({ hero: 205, commerce: 325, parcelization: 135, network: 280, freight: 215, "last-mile": 340, finale: 150 });
    expect(HOME_MOBILE_CHAPTER_BUDGETS_VH).toEqual({ hero: 260, commerce: 250, parcelization: 115, network: 225, freight: 185, "last-mile": 310, finale: 150 });
    expect(HOME_MOBILE_POLICY).toEqual({ hero: "document", commerce: "native-snap", parcelization: "document", network: "sticky", freight: "sticky", "last-mile": "sticky", finale: "sticky" });
    expect(HOME_BEATS.hero.release).toEqual([.975, 1]);
  });

  it("registers every canonical post-Hero state as generated WebP metadata", () => {
    expect(POST_HERO_RESOLVER_ACTOR_STATES).toHaveLength(55);
    for (const key of POST_HERO_RESOLVER_ACTOR_STATES) {
      expect(GENERATED_ACTOR_STATES[key]).toMatchObject({ webpSrc: expect.stringMatching(/\.webp$/) });
    }
  });

  it("keeps Handoff exclusive and reconstructs the required Last Mile states", () => {
    const at = (progress: number) => resolvePostHeroFrame("last-mile", progress, "desktop");
    expect(at(.04).actors.van.visible).toBe(false);
    expect(at(.1).actors.van.state).toContain("delivery-entry");
    expect(at(.35).actors.van.state).toContain("door-open");
    expect(at(.46).actors.courier.visible).toBe(true);
    expect(at(.55).actors.recipient.visible).toBe(true);
    expect(at(.72).actors.handoff.visible).toBe(true);
    expect(at(.72).actors.courier.visible).toBe(false);
    expect(at(.72).actors.recipient.visible).toBe(false);
    expect(at(.82).actors.handoff.state).toBe("handoff:separation");
    expect(at(.82).actors.recipient.visible).toBe(false);
    expect(at(.85).actors.recipient.visible).toBe(true);
    expect(at(.9).actors.courier.state).toContain("return-right");
    expect(at(.95).actors.van.state).toContain("door-close");
    expect(at(.99).actors.van.state).toContain("departure");
  });

  it("uses the authored White Truck route sequence", () => {
    expect(resolvePostHeroFrame("network", .2, "desktop").actors["white-truck"].state).toBe("white-truck:top-down-straight");
    expect(resolvePostHeroFrame("network", .52, "desktop").actors["white-truck"].state).toBe("white-truck:top-down-angled");
    expect(resolvePostHeroFrame("network", .78, "desktop").actors["white-truck"].state).toBe("white-truck:top-down-turning");
  });
});
