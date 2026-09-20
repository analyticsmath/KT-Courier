import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterBudgetVh, mobileChapterBudgetVh } from "@/components/public-v3/home/director/home-chapters";

const root = process.cwd();
const styles = readFileSync(join(root, "components/public-v3/home/home-scenes.module.css"), "utf8");
const heroScene = readFileSync(join(root, "components/public-v3/home/scenes/HeroScene.tsx"), "utf8");
const director = readFileSync(join(root, "components/public-v3/home/director/useHomeNarrativeDirector.ts"), "utf8");
const actorStage = readFileSync(join(root, "components/public-v3/actors/CinematicActorStage.tsx"), "utf8");

describe("mobile hero geometry contract", () => {
  it("keeps the authored desktop and mobile hero budgets", () => {
    expect(chapterBudgetVh("hero")).toBe(205);
    expect(mobileChapterBudgetVh("hero")).toBe(260);
  });

  it("excludes hero from generic mobile scene normalization and reapplies its budget", () => {
    expect(styles).toMatch(
      /@media \(max-width: 767px\) \{\s*:global\(\.kt-home-experience \[data-kt-scene\]:not\(\[data-kt-scene="hero"\]\)\) \{\s*min-height: auto !important;\s*height: auto;\s*\}\s*:global\(\.kt-home-experience \[data-kt-scene="hero"\]\) \{\s*min-height: calc\(var\(--kt-home-mobile-budget, 260\) \* 1svh\) !important;\s*height: auto;/,
    );
    expect(styles).not.toMatch(
      /@media \(max-width: 767px\) \{\s*:global\(\.kt-home-experience \[data-kt-scene\]\) \{\s*min-height: auto !important;/,
    );
  });

  it("keeps the mobile hero stage sticky and outside generic stage unpinning", () => {
    expect(styles).toMatch(
      /@media \(max-width: 767px\) \{\s*\.heroStage \{\s*position: sticky;\s*top: 0;\s*height: 100svh;\s*min-height: 100svh;/,
    );
    expect(heroScene).toContain("className={styles.heroStage}");
    expect(heroScene).not.toContain("kt-home-sticky-stage");
    expect(heroScene).toContain("--kt-home-mobile-budget");
  });

  it("keeps the mobile CTA row above the shared navigation-safe boundary", () => {
    expect(styles).not.toContain("clamp(10rem, 25svh, 13rem)");
    expect(styles).toMatch(/\.heroActionsRow\s*\{\s*left: 50%;\s*bottom: var\(--kt-mobile-action-safe-bottom\);/);
  });

  it("uses measured actor-stage geometry for mobile Hero placement", () => {
    expect(director).toContain("stageWidthPx = actorStageRect?.width || window.innerWidth");
    expect(director).toContain("stageHeightPx = actorStageRect?.height || window.innerHeight");
    expect(director).toContain("const sizingHeight = mobileHeroGeometry ? stageHeightPx : window.innerHeight");
    expect(director).toContain("y: mobileHeroGeometry ? stageHeightPx * actor.groundY");
    expect(actorStage).toMatch(/preloadStates=\{\[\.\.\.HERO_TRUCK_SEQUENCE\.slice\(0, 6\)\]\}/);
    expect(actorStage).toContain("preloadStates={[]}");
  });
});
