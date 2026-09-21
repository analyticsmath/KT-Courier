import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_CHAPTERS } from "@/components/public-v3/home/director/home-chapters";
import { POST_HERO_RESOLVER_ACTOR_STATES } from "@/components/public-v3/home/director/post-hero-frame-resolver";
import { POST_HERO_RENDERED_ACTOR_STATES } from "@/components/public-v3/home/actors/PostHeroActorSprite";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const experience = read("components/public-v3/home/PublicHomeExperience.tsx");
const marketplace = read("components/public-v3/home/scenes/MarketplaceFivePanelScene.tsx");
const director = read("components/public-v3/home/director/useHomeNarrativeDirector.ts");
const postHeroCss = read("components/public-v3/home/post-hero-scenes.module.css");
const actors = read("components/public-v3/home/actors/PostHeroActorSprite.tsx");

describe("post-Hero V4 contracts", () => {
  it("renders only the accepted Hero and five grouped post-Hero worlds", () => {
    expect(HOME_CHAPTERS).toEqual(["hero", "marketplace", "preparation", "journey", "freight", "finale"]);
    ["<HeroScene", "<MarketplaceFivePanelScene", "<PreparationScene", "<DeliveryJourneyScene", "<FreightNetworkScene", "<ArrivalFinaleScene"].forEach((scene) => {
      expect(experience).toContain(scene);
    });
    ["<ImageFanScene", "<CollectionScene", "<CustodySplitScene", "<RouteScene", "<FreightScene", "<ArrivalScene", "<FinaleScene"].forEach((scene) => {
      expect(experience).not.toContain(scene);
    });
    expect(experience.match(/<HeroScene\s*\/>/g)).toHaveLength(1);
  });

  it("uses a stable Marketplace world and one exit-only strip layer", () => {
    expect(marketplace).not.toContain("data-marketplace-backdrop");
    expect(marketplace).not.toContain("marketplaceBackdrop");
    expect(marketplace.match(/data-marketplace-exit-slice=/g)).toHaveLength(1);
    expect(director).not.toContain("marketplace-backdrop");
    expect(director).toContain("HOME_BEATS.marketplace.exitSlices");
    expect(postHeroCss).toContain("background: #090c0e");
    expect(postHeroCss).toContain("scroll-snap-type: x mandatory");
    expect(postHeroCss).not.toContain("marketplaceAtmosphere");
  });

  it("keeps the portal inside Marketplace with one selected centre and support media", () => {
    expect(marketplace).toContain("data-marketplace-portal");
    expect(marketplace).toContain("data-marketplace-portal-center");
    expect(marketplace).toContain("data-marketplace-portal-support-id");
    expect(marketplace).toContain("From shelf to parcel.");
    expect(marketplace).not.toContain("<h2>From shelf to parcel.");
    expect(director).toContain("marketplaceManualSelectionId");
    expect(director).toContain("frozenExitSelectionId = chosen ?? null");
    expect(director).toContain("exitSliceCount = mobileExit ? 5 : 7");
    expect(postHeroCss).toContain(".marketplaceExitSlices > span:nth-child(n+6)");
  });

  it("owns local post-Hero actors and covers every resolver request", () => {
    expect(new Set(POST_HERO_RENDERED_ACTOR_STATES)).toEqual(new Set(POST_HERO_RESOLVER_ACTOR_STATES));
    expect(actors).toContain("data-posthero-actor-slot={actor}");
    expect(actors).toContain("data-posthero-scene={scene}");
    expect(actors).toContain("loading=\"eager\"");
    expect(director).toContain("preloadPostHeroActorsForChapter(\"journey\")");
    expect(director).toContain("preloadPostHeroActorsForChapter(\"freight\")");
    expect(director).toContain("preloadPostHeroActorsForChapter(\"finale\")");
  });

  it("uses native mobile Marketplace browsing and an authored reduced-motion still", () => {
    expect(postHeroCss).toMatch(/\.marketplaceSection\s*\{[^}]*min-height: var\(--kt-home-mobile-budget, 100svh\)/s);
    expect(postHeroCss).toContain("scroll-snap-align: center");
    expect(postHeroCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(postHeroCss).toContain(".finaleTitle { transform: none !important; opacity: 1 !important; }");
  });

  it("keeps copy about the service and removes animation commentary", () => {
    expect(read("components/public-v3/home/scenes/PreparationScene.tsx")).toContain("The order becomes a parcel.");
    expect(read("components/public-v3/home/scenes/DeliveryJourneyScene.tsx")).not.toContain("The van arrives, holds its place");
    expect(read("components/public-v3/home/scenes/ArrivalFinaleScene.tsx")).toContain("Delivered.");
    expect(read("components/public-v3/home/scenes/ArrivalFinaleScene.tsx").match(/<h2/g)).toHaveLength(1);
  });

  it("keeps one display owner for the final KT COURIER identity", () => {
    expect(read("components/public-v3/home/scenes/ArrivalFinaleScene.tsx").match(/>COURIER</g)).toHaveLength(1);
    expect(read("components/public-v3/home/scenes/ArrivalFinaleScene.tsx")).not.toContain("data-motion=\"arrival-footer-title\"");
  });
});
