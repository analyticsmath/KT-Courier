import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import postcss from "postcss";
import { FEATURED_MARKETPLACE_CATEGORY_PATHS } from "@/lib/public-marketplace/featured-categories";
import { buildCinematicCategoryNavigation } from "@/lib/public-marketplace/category-navigation-model";
import { categoryTransitionId } from "@/lib/public-marketplace/category-transition-id";
import {
  categoryFanPose,
  wrappedCategoryDelta,
} from "@/components/public-v2/commerce/category-navigator-geometry";
import { categoryOrbitAngle } from "@/components/public-v2/commerce/category-orbit-geometry";
import { CATEGORY_SPINNER_TIMING } from "@/components/public-v2/commerce/category-navigator-timing";

const source = (file: string) =>
  readFileSync(path.join(process.cwd(), file), "utf8");
const page = source("app/(public)/shop/categories/page.tsx");
const destination = source(
  "app/(public)/shop/categories/[...categoryPath]/page.tsx",
);
const navigator = source("components/public-v2/commerce/CategoryAtlas.tsx");
const fan = source("components/public-v2/commerce/CategoryFanDeck.tsx");
const orbit = source("components/public-v2/commerce/CategoryOrbitSpinner.tsx");
const accordion = source(
  "components/public-v2/commerce/SubcategoryAccordion.tsx",
);
const css = source(
  "components/public-v2/commerce/category-navigator.module.css",
);
const model = source("lib/public-marketplace/category-navigation-model.ts");
const timing = source(
  "components/public-v2/commerce/category-navigator-timing.ts",
);

function orbitStyle(selector: string): Map<string, string> {
  const declarations = new Map<string, string>();
  postcss.parse(css).walkRules(selector, (rule) =>
    rule.walkDecls((declaration) => {
      declarations.set(declaration.prop, declaration.value);
    }),
  );
  return declarations;
}

describe("cinematic category navigation", () => {
  it("keeps authored ordering and enriches children from one full taxonomy", () => {
    expect(FEATURED_MARKETPLACE_CATEGORY_PATHS).toEqual([
      "groceries",
      "fashion",
      "food-dining",
      "home-living",
      "pharmacy",
    ]);
    const taxonomy = [
      {
        reference: "child",
        path: "/groceries/fresh/",
        name: "Fresh",
        description: "Fresh food",
        imageReference: "media-1",
        productCount: 12,
      },
      { reference: "fashion", path: "/fashion", name: "Fashion" },
      {
        reference: "grocery",
        path: "/groceries",
        name: "Groceries",
        children: [
          { reference: "child", path: "groceries/fresh", name: "Fresh" },
          {
            reference: "missing",
            path: "/groceries/unlisted",
            name: "Unlisted",
          },
        ],
      },
    ];
    const result = buildCinematicCategoryNavigation(taxonomy);
    expect(result.map((category) => category.name)).toEqual([
      "Groceries",
      "Fashion",
    ]);
    expect(result[0].children[0]).toEqual({
      reference: "child",
      path: "groceries/fresh",
      name: "Fresh",
      description: "Fresh food",
      imageReference: "media-1",
      productCount: 12,
    });
    expect(result[0].children[1]).toEqual({
      reference: "missing",
      path: "/groceries/unlisted",
      name: "Unlisted",
    });
    expect(page).toContain(
      "buildCinematicCategoryNavigation(categoryTaxonomy)",
    );
    expect(model).not.toMatch(/prisma|queryRaw|fetch\(/);
  });

  it("replaces the old page introduction with one navigator and explicit locked phases", () => {
    expect(page).not.toMatch(/CommerceBreadcrumbs|commercePageIntro/);
    expect(page).toContain("<CategoryAtlas categories={categories}");
    for (const phase of [
      "intro-spin",
      "major-categories",
      "category-transition",
      "subcategories",
      "return-transition",
    ])
      expect(navigator).toContain(phase);
    expect(navigator).toContain(
      'phase === "major-categories" || (isCompact && phase === "intro-spin")',
    );
    expect(navigator).toContain("Skip animation");
    expect(navigator).toContain("if (!interactive");
    expect(navigator).not.toContain("setInterval");
  });

  it("uses one readable revolution for each count-derived 3D orbit", () => {
    expect(orbit).toContain("360 / categories.length");
    expect(
      [0, 1, 2, 3, 4].map((index) => categoryOrbitAngle(index, 5)),
    ).toEqual([0, 72, 144, 216, 288]);
    expect(orbit).toMatch(
      /rotateY\(\$\{categoryOrbitAngle\(index, categories\.length\)\}deg\) translateZ/,
    );
    expect(orbit).toContain('kind === "intro" ? 360');
    expect(orbit).toContain("selectedFrontRotation + 360");
    expect(orbit).toContain("selectedFrontRotation - 360");
    expect(orbit).toContain(
      "const selectedFrontRotation = -destinationIndex * angleStep",
    );
    expect(orbit).not.toMatch(/720(?:deg)?/);
    expect(orbit).not.toMatch(/\bopacity\s*:/);
    expect(orbit).toContain("CATEGORY_SPINNER_TIMING");
    expect(navigator).toContain("CATEGORY_SPINNER_TIMING");
    expect(timing).toContain("CATEGORY_SPINNER_TIMING");
    expect(CATEGORY_SPINNER_TIMING.introSpinMs).toBeGreaterThanOrEqual(3200);
    expect(CATEGORY_SPINNER_TIMING.selectionSpinMs).toBeGreaterThanOrEqual(
      2000,
    );
    expect(CATEGORY_SPINNER_TIMING.returnSpinMs).toBeGreaterThanOrEqual(1500);
    expect(
      CATEGORY_SPINNER_TIMING.introSpinMs +
        CATEGORY_SPINNER_TIMING.introResolveMs,
    ).toBe(4050);
    expect(
      CATEGORY_SPINNER_TIMING.selectionCenterMs +
        CATEGORY_SPINNER_TIMING.selectionSpinMs +
        CATEGORY_SPINNER_TIMING.selectionResolveMs,
    ).toBe(2900);
    expect(
      CATEGORY_SPINNER_TIMING.returnFoldMs +
        CATEGORY_SPINNER_TIMING.returnSpinMs +
        CATEGORY_SPINNER_TIMING.returnResolveMs,
    ).toBe(2350);
    expect([
      CATEGORY_SPINNER_TIMING.compactIntroResolveMs,
      CATEGORY_SPINNER_TIMING.compactIntroFinishMs,
      CATEGORY_SPINNER_TIMING.compactSelectionCenterMs,
      CATEGORY_SPINNER_TIMING.compactSelectionFinishMs,
      CATEGORY_SPINNER_TIMING.compactReturnFoldMs,
      CATEGORY_SPINNER_TIMING.compactReturnFinishMs,
    ]).toEqual([600, 750, 90, 570, 100, 470]);
  });

  it("keeps the pitched, two-sided orbit spatially intact", () => {
    expect(orbitStyle(".orbitViewport").get("perspective")).toBe("1700px");
    expect(orbitStyle(".orbitViewport").get("perspective-origin")).toBe(
      "50% 46%",
    );
    expect(orbitStyle(".orbitStage").get("overflow")).toBe("visible");
    expect(orbitStyle(".orbitViewport").get("overflow")).toBe("visible");
    expect(orbitStyle(".orbitRig").get("transform")).toBe("rotateX(-10deg)");
    expect(orbitStyle(".stage").get("--orbit-radius")).toBe(
      "clamp(260px, 20vw, 360px)",
    );
    expect(orbitStyle(".orbitRing").get("width")).toBe(
      "clamp(176px, 12vw, 220px)",
    );
    for (const selector of [".orbitRig", ".orbitRing", ".orbitCard"]) {
      const style = orbitStyle(selector);
      expect(style.get("transform-style")).toBe("preserve-3d");
      expect(style.get("overflow")).not.toBe("hidden");
      for (const flattening of [
        "opacity",
        "filter",
        "clip-path",
        "mask",
        "mix-blend-mode",
        "contain",
      ])
        expect(style.has(flattening)).toBe(false);
    }
    expect(orbitStyle(".orbitCard").get("overflow")).toBe("visible");
    expect(orbitStyle(".orbitFace").get("backface-visibility")).toBe("hidden");
    expect(orbitStyle(".orbitFace").get("overflow")).toBe("hidden");
    expect(orbitStyle(".orbitFace").get("-webkit-backface-visibility")).toBe(
      "hidden",
    );
    expect(orbitStyle(".orbitFaceBack").get("transform")).toBe(
      "rotateY(180deg) translateZ(.5px)",
    );
    expect(orbitStyle(".orbitRearShade").get("background")).toBe(
      "rgba(11, 13, 15, .20)",
    );
    expect(orbit).toContain("styles.orbitFaceFront");
    expect(orbit).toContain("styles.orbitFaceBack");
    expect(orbit.match(/<Image\b/g)).toHaveLength(2);
  });

  it("distinguishes center, neighbors and outer cards with safe wrapping", () => {
    expect(
      [-2, -1, 0, 1, 2].map((index) => wrappedCategoryDelta(index, 0, 5)),
    ).toEqual([-2, -1, 0, 1, 2]);
    expect(wrappedCategoryDelta(4, 0, 5)).toBe(-1);
    expect(wrappedCategoryDelta(3, 0, 4)).toBe(-1);
    expect(
      new Set([0, 1, 2, 3].map((index) => wrappedCategoryDelta(index, 0, 4)))
        .size,
    ).toBe(4);
    expect(categoryFanPose(0).scale).toBeGreaterThan(categoryFanPose(1).scale);
    expect(categoryFanPose(1).scale).toBeGreaterThan(categoryFanPose(2).scale);
    expect(categoryFanPose(1).rotateY).not.toBe(categoryFanPose(2).rotateY);
    expect(fan).toContain("categories.map");
    expect(fan).toContain("wrappedCategoryDelta");
    expect(navigator).toContain("Previous category");
    expect(navigator).toContain("Next category");
    expect(navigator).toContain("handleWheel");
    expect(fan).toContain('drag={interactive ? "x" : false}');
    expect(navigator).toContain('event.key === "ArrowLeft"');
    expect(navigator).toContain('event.key === "ArrowRight"');
  });

  it("opens a parent in-page, handles zero children, and renders dynamic full-link strips", () => {
    expect(fan).toContain("<motion.button");
    expect(fan).not.toContain("marketplaceCategoryHref");
    expect(navigator).toContain("setSelectedMajorIndex(index)");
    expect(navigator).toContain('setPhase("category-transition")');
    expect(navigator).toContain('setPhase("subcategories")');
    expect(navigator).toContain("parent.children.length === 0");
    expect(accordion).toContain("parent.children.slice(0, 8)");
    expect(accordion).toContain("visibleChildren.map");
    expect(accordion).toContain("flexGrow: isActive ? activeGrow : 1");
    expect(accordion).toContain("onMouseEnter={() => onActiveChange(index)}");
    expect(accordion).toContain("onFocus={() => onActiveChange(index)}");
    expect(accordion).toContain("<Link");
    expect(accordion).toContain("marketplaceCategoryHref(child.path)");
  });

  it("hands child media to the destination with the same normalized ID", () => {
    expect(categoryTransitionId("/groceries/fresh-produce/")).toBe(
      "category-groceries--fresh-produce",
    );
    expect(categoryTransitionId('groceries/"fresh"')).toBe(
      "category-groceries---fresh-",
    );
    expect(accordion).toContain(
      "captureSourceMedia(categoryTransitionId(child.path)",
    );
    expect(destination).toContain(
      "data-kt-shared-target={categoryTransitionId(category.path)}",
    );
  });

  it("keeps reduced motion and touch layouts navigable without autoplay", () => {
    expect(navigator).toContain(
      'prefersReducedMotion && phase === "intro-spin"',
    );
    expect(navigator).toContain(
      "CATEGORY_SPINNER_TIMING.reducedSelectionFinishMs",
    );
    expect(navigator).toContain("!prefersReducedMotion && !isCompact");
    expect(css).toContain(".reduced .strip");
    expect(css).toContain("scroll-snap-type: x mandatory");
    expect(fan).toContain("className={styles.mobileCard}");
    expect(fan).toContain("onClick={() => onSelect(index)}");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toContain("grid-template-columns: 1fr");
    expect(css).toContain("height: 150px");
    expect(navigator).not.toContain("setInterval");
  });
});
