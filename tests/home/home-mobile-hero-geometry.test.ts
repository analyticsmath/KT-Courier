import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterBudgetVh, mobileChapterBudgetVh } from "@/components/public-v3/home/director/home-chapters";

const root = process.cwd();
const styles = readFileSync(join(root, "components/public-v3/home/home-scenes.module.css"), "utf8");
const heroScene = readFileSync(join(root, "components/public-v3/home/scenes/HeroScene.tsx"), "utf8");

describe("mobile hero geometry contract", () => {
  it("keeps the authored desktop and mobile hero budgets", () => {
    expect(chapterBudgetVh("hero")).toBe(205);
    expect(mobileChapterBudgetVh("hero")).toBe(190);
  });

  it("excludes hero from generic mobile scene normalization and reapplies its budget", () => {
    expect(styles).toMatch(
      /@media \(max-width: 767px\) \{\s*:global\(\.kt-home-experience \[data-kt-scene\]:not\(\[data-kt-scene="hero"\]\)\) \{\s*min-height: auto !important;\s*height: auto;\s*\}\s*:global\(\.kt-home-experience \[data-kt-scene="hero"\]\) \{\s*min-height: calc\(var\(--kt-home-mobile-budget, 190\) \* 1svh\) !important;\s*height: auto;/,
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
});
