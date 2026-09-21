import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_CHAPTERS } from "@/components/public-v3/home/director/home-chapters";
import { POST_HERO_RESOLVER_ACTOR_STATES } from "@/components/public-v3/home/director/post-hero-frame-resolver";
import { POST_HERO_RENDERED_ACTOR_STATES } from "@/components/public-v3/home/actors/PersistentPostHeroCinematicLayer";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const experience = read("components/public-v3/home/PublicHomeExperience.tsx");
const marketplace = read("components/public-v3/home/scenes/MarketplaceFivePanelScene.tsx");
const director = read("components/public-v3/home/director/useHomeNarrativeDirector.ts");
const actors = read("components/public-v3/home/actors/PersistentPostHeroCinematicLayer.tsx");
const runtime = read("components/public-v3/home/actors/post-hero-cinematic-runtime.ts");
const postHeroCss = read("components/public-v3/home/post-hero-scenes.module.css");

describe("post-Hero V5 continuity contracts", () => {
  it("keeps the accepted Hero and the five grouped post-Hero chapters", () => {
    expect(HOME_CHAPTERS).toEqual(["hero", "marketplace", "preparation", "journey", "freight", "finale"]);
    ["<HeroScene", "<MarketplaceFivePanelScene", "<PreparationScene", "<DeliveryJourneyScene", "<FreightNetworkScene", "<ArrivalFinaleScene"].forEach((scene) => {
      expect(experience).toContain(scene);
    });
    expect(experience.match(/<HeroScene\s*\/>/g)).toHaveLength(1);
  });

  it("uses one category rail and a single card-bounds-to-strips exit", () => {
    expect(marketplace).not.toMatch(/marketplacePortal|portalConstellation|portalSupport/);
    expect(experience).not.toContain("PersistentStoryMediaLayer");
    expect(experience).not.toContain("data-persistent-story-media");
    expect(director).not.toMatch(/storyMediaFrame|storyMediaLayer|marketplacePortal|portalProgress/);
    expect(director).toContain("HOME_BEATS.marketplace.finalCardHold");
    expect(director).toContain("HOME_BEATS.marketplace.exitSlices");
    expect(director).toContain("activeCard?.getBoundingClientRect()");
    expect(marketplace).toContain("length: 7");
    expect(marketplace).toContain("data-marketplace-exit-outgoing");
    expect(marketplace).toContain("data-marketplace-exit-incoming");
    expect(postHeroCss).not.toMatch(/marketplacePortal|storyMediaLayer|storyMediaFrame/);
    expect(postHeroCss).toContain("scroll-snap-type: x mandatory");
    expect(postHeroCss).toContain("flex-basis: 84vw");
  });

  it("mounts one persistent post-Hero actor layer with exactly the requested inventory", () => {
    expect(experience.match(/<PersistentPostHeroCinematicLayer\s*\/>/g)).toHaveLength(1);
    expect(experience).toContain("introResolved ? <PersistentPostHeroCinematicLayer");
    expect(new Set(POST_HERO_RENDERED_ACTOR_STATES)).toEqual(new Set(POST_HERO_RESOLVER_ACTOR_STATES));
    expect(POST_HERO_RESOLVER_ACTOR_STATES).toHaveLength(8);
    expect(actors).toContain("data-posthero-actor-slot={actor}");
    expect(actors).toContain("data-posthero-expected-actor={actor}");
    expect(actors).toContain("decoding=\"async\"");
    expect(actors).toContain("deferred ? \"lazy\" : \"eager\"");
    expect(actors).not.toContain("extending-handoff");
    ["van:collection-side-right", "van:collection-door-open-right", "courier:look-right-approach", "courier:lift-parcel", "courier:loading-unloading", "courier:ready-handover", "white-truck:top-down-straight", "red-truck:side-right"].forEach((state) => {
      expect(actors).toContain(state);
    });
    ["DeliveryJourneyScene.tsx", "FreightNetworkScene.tsx", "ArrivalFinaleScene.tsx"].forEach((file) => {
      expect(read(`components/public-v3/home/scenes/${file}`)).not.toContain("PostHeroActorBank");
    });
    expect(director).not.toContain("hideLocalActorSlots");
    expect(director).not.toContain("localSlots.forEach");
    expect(runtime).toContain("pendingState: requestedReady ? null : requestedState");
    expect(runtime).toContain("displayedState: previous.displayedState");
    ["data-posthero-requested-state", "data-posthero-displayed-state", "data-posthero-state-ready", "data-posthero-slot-opacity", "data-posthero-x", "data-posthero-y", "data-posthero-width"].forEach((attribute) => {
      expect(actors).toContain(attribute);
    });
  });

  it("uses the same street frame at Preparation exit and Journey entry", () => {
    const preparation = read("components/public-v3/home/scenes/PreparationScene.tsx");
    const journey = read("components/public-v3/home/scenes/DeliveryJourneyScene.tsx");
    expect(preparation).toContain("ktMediaV3.editorial.merchant.mabonengDepot");
    expect(journey).toContain("ktMediaV3.editorial.merchant.mabonengDepot");
    expect(preparation).toContain("data-preparation-street");
    expect(director).toContain("frame.streetReveal");
  });

  it("keeps the route and freight vehicles present through their physical handoffs", () => {
    const journey = read("components/public-v3/home/scenes/DeliveryJourneyScene.tsx");
    const freight = read("components/public-v3/home/scenes/FreightNetworkScene.tsx");
    expect(journey).toContain("data-route-path");
    expect(director).toContain("routeTruckRotationForTangent(tangent)");
    expect(director).toContain("preloadPostHeroActorsForChapter(\"journey\")");
    expect(director).toContain("preloadPostHeroActorsForChapter(\"freight\")");
    expect(freight).toContain("Built for more than small parcels.");
    expect(freight).toContain("Road freight");
    expect(freight).toContain("Air cargo");
    expect(freight).toContain("Customs");
    expect(freight).toContain("Warehousing");
    expect(freight).toContain("ktMediaV3.editorial.courier.physicalHandoff");
  });

  it("starts Finale on the physical handoff image with one KT / COURIER owner", () => {
    const finale = read("components/public-v3/home/scenes/ArrivalFinaleScene.tsx");
    expect(finale).toContain("ktMediaV3.editorial.courier.physicalHandoff");
    expect(finale).toContain("Delivered.");
    expect(finale).not.toContain("PostHeroActorBank");
    expect(finale).not.toContain("courier:extending-handoff");
    expect(finale.match(/<h2/g)).toHaveLength(1);
    expect(finale.match(/>COURIER</g)).toHaveLength(1);
  });

  it("keeps reduced-motion stills and allows mobile to use its authored actor timeline", () => {
    expect(postHeroCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(postHeroCss).toContain("(max-width: 767px) and (prefers-reduced-motion: no-preference)");
    expect(postHeroCss).toContain("min-height: auto !important;\n    height: auto;");
    expect(postHeroCss).toContain(".finaleTitle { transform: none !important; opacity: 1 !important;");
    expect(postHeroCss).toContain("[data-kt-scene=\"journey\"] [data-home-sticky-stage]");
    expect(postHeroCss).toContain("--kt-home-mobile-budget, 290");
    expect(postHeroCss).toContain("--kt-home-mobile-budget, 210");
  });
});
