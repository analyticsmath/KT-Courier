import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_CHAPTERS } from "@/components/public-v3/home/director/home-chapters";
import { POST_HERO_RESOLVER_ACTOR_STATES } from "@/components/public-v3/home/director/post-hero-frame-resolver";
import { POST_HERO_RENDERED_ACTOR_STATES } from "@/components/public-v3/home/actors/PersistentPostHeroCinematicLayer";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("post-Hero implementation contracts", () => {
  it("keeps the accepted Hero and current chapter architecture", () => {
    const experience = read("components/public-v3/home/PublicHomeExperience.tsx");
    expect(HOME_CHAPTERS).toEqual(["hero", "commerce", "parcelization", "network", "freight", "last-mile", "finale"]);
    ["<HeroScene", "<CommerceWorldScene", "<ParcelizationScene", "<NetworkRouteScene", "<FreightTransitionScene", "<LastMileDeliveryScene", "<ArrivalFinaleScene"].forEach((scene) => expect(experience).toContain(scene));
    expect(experience.match(/<HeroScene\s*\/>/g)).toHaveLength(1);
  });

  it("uses one viewport with conditional commerce worlds", () => {
    const commerce = read("components/public-v3/home/scenes/CommerceWorldScene.tsx");
    const director = read("components/public-v3/home/director/useHomeNarrativeDirector.ts");
    expect(commerce).toContain("data-commerce-world=\"categories\"");
    expect(commerce).toContain("data-commerce-world=\"stores\"");
    expect(commerce).toContain("data-commerce-world=\"products\"");
    expect(commerce).toContain("stores.length >= 3");
    expect(director).toContain("marketplaceTrackX");
    expect(director).toContain("world.dataset.commerceActive");
    expect(director).toContain("categoryTrack");
  });

  it("keeps product fan assets lazy and preserves a valid ready fallback", () => {
    const actors = read("components/public-v3/home/actors/PersistentPostHeroCinematicLayer.tsx");
    const director = read("components/public-v3/home/director/useHomeNarrativeDirector.ts");
    expect(new Set(POST_HERO_RENDERED_ACTOR_STATES)).toEqual(new Set(POST_HERO_RESOLVER_ACTOR_STATES));
    expect(actors).toContain('"data-src": asset.webpSrc');
    expect(actors).toContain('loading={eager ? "eager" : "lazy"}');
    expect(director).toContain("displayedPostStates");
    expect(director).toContain("activateLayer");
  });

  it("keeps parcel continuity and route-origin geometry explicit", () => {
    const parcel = read("components/public-v3/home/scenes/ParcelizationScene.tsx");
    const director = read("components/public-v3/home/director/useHomeNarrativeDirector.ts");
    expect(parcel).toContain("data-parcel-selected-product-media");
    expect(director).toContain("data-commerce-selected-product-media");
    expect(director).toContain("data-product-carry-layer");
    expect(parcel).toContain("data-package-back");
    expect(parcel).toContain("data-package-cover");
    expect(parcel).toContain("data-package-label");
    expect(parcel).toContain("data-label-route-line");
    expect(director).toContain("clipPath");
    expect(director).toContain("frame.labelRouteProgress");
  });

  it("keeps route occlusion, mobile ownership, and reduced-motion budgets explicit", () => {
    const network = read("components/public-v3/home/scenes/NetworkRouteScene.tsx");
    const director = read("components/public-v3/home/director/useHomeNarrativeDirector.ts");
    const css = read("components/public-v3/home/post-hero-rebuild.module.css");
    expect(network).toContain('data-route-occluder="straight-angled"');
    expect(network).toContain('data-route-occluder="angled-turning"');
    expect(director).toContain("desktopCommerceDirectorOwned");
    expect(director).toContain("window.innerWidth >= 900");
    expect(css).toContain('[data-kt-scene="commerce"]');
    expect(css).toContain("min-height: auto !important");
  });

  it("reserves Delivered for the finale after custody transfer", () => {
    const lastMile = read("components/public-v3/home/scenes/LastMileDeliveryScene.tsx");
    const finale = read("components/public-v3/home/scenes/ArrivalFinaleScene.tsx");
    expect(lastMile).toContain("Almost there");
    expect(lastMile).not.toContain(">Delivered<");
    expect(finale).toContain("Delivered.");
  });
});
