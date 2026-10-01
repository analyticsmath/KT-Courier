import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import {
  circularRelative,
  selectCinemaStores,
} from "@/components/public-v2/marketplace/store-cinema-selection";
import type { MarketplaceStore } from "@/components/public-v2/marketplace/MarketplaceLanding";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");
const commerce = "components/public-v2/commerce/";
const shop = "components/public-v2/marketplace/";

function declarations(path: string, selector: string) {
  const matches: Array<{ media: string; props: Record<string, string> }> = [];
  postcss.parse(source(path)).walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const props: Record<string, string> = {};
    rule.walkDecls((declaration) => {
      props[declaration.prop] = declaration.value;
    });
    matches.push({
      media: rule.parent?.type === "atrule" ? rule.parent.params : "",
      props,
    });
  });
  return matches;
}

describe("Commerce visual correction IV", () => {
  it("wraps seven real stores around the fixed aperture at both endpoints", () => {
    const stores: MarketplaceStore[] = Array.from(
      { length: 9 },
      (_, index) => ({
        reference: String(index),
        slug: String(index),
        name: `Store ${index}`,
        publishedOfferCount: index,
      }),
    );
    const featured = selectCinemaStores(stores, "featured");
    expect(featured).toHaveLength(7);
    expect(new Set(featured.map((store) => store.reference)).size).toBe(7);
    expect([5, 6].map((index) => circularRelative(index, 0, 7))).toEqual([
      -2, -1,
    ]);
    expect([0, 1].map((index) => circularRelative(index, 6, 7))).toEqual([
      1, 2,
    ]);
    expect(circularRelative(0, 3.5, 7)).toBe(-3.5);
    const cinema = source(`${shop}StoreCinema.tsx`);
    expect(cinema).toContain("circularRelative(index, value, count)");
    expect(cinema).toContain("count={featured.length}");
    expect(cinema.match(/className=\{styles\.focusAperture\}/g)).toHaveLength(
      1,
    );
    expect(
      cinema.slice(
        cinema.indexOf("function CinemaPanel"),
        cinema.indexOf("export function StoreCinema"),
      ),
    ).not.toContain("focusOutline");
    expect(cinema).toContain("className={styles.focusLink}");
    expect(cinema).toContain("const native = mobile || Boolean(reducedMotion)");
    expect(
      declarations(`${shop}store-cinema.module.css`, ".focusAperture")[0]?.props
        .transform,
    ).toBe("translate(-50%, -50%)");
    expect(
      declarations(`${shop}store-cinema.module.css`, ".directoryTitle")[0]
        ?.props.right,
    ).toContain("56px");
  });

  it("uses a single contained manual PDP recommendation rail", () => {
    const detail = source(`${commerce}ProductDetailExperience.tsx`);
    const rail = source(`${commerce}MarketplaceProductRail.tsx`);
    const css = `${commerce}commerce.module.css`;
    expect(detail.match(/<MarketplaceProductRail/g)).toHaveLength(2);
    expect(detail).not.toContain("<ProductGrid");
    expect(rail).toContain('variant="related"');
    expect(rail).toContain("scrollBy({ left:");
    expect(rail).toContain("aria-label={`Scroll ${title} left`}");
    expect(rail).toContain("aria-label={`Scroll ${title} right`}");
    expect(declarations(css, ".recommendationTrack")[0]?.props.display).toBe(
      "flex",
    );
    expect(
      declarations(css, ".recommendationTrack")[0]?.props["align-items"],
    ).toBe("stretch");
    expect(
      declarations(css, ".recommendationTrack")[0]?.props["overflow-x"],
    ).toBe("auto");
    expect(
      declarations(css, ".recommendationTrack > li")[0]?.props.flex,
    ).toContain("/ 4");
    expect(
      declarations(css, ".recommendationTrack > li").some(
        (rule) =>
          rule.media.includes("max-width: 1279px") &&
          rule.props["flex-basis"]?.includes("/ 3"),
      ),
    ).toBe(true);
    expect(
      declarations(css, ".recommendationTrack > li").some(
        (rule) =>
          rule.media.includes("max-width: 767px") &&
          rule.props["flex-basis"] === "calc((100vw - 44px) / 2)",
      ),
    ).toBe(true);
  });

  it("contains canonical grid cards and separates product rows", () => {
    const card = source(`${commerce}MarketplaceProductCard.tsx`);
    const cardCss = `${commerce}marketplace-product-card.module.css`;
    const gridCss = `${commerce}commerce.module.css`;
    expect(card).toContain("<QuickBuySheet");
    expect(card).toContain("Quick add ${product.title}");
    expect(card).not.toContain("View item");
    expect(declarations(cardCss, ".card")[0]?.props.overflow).toBe("hidden");
    expect(declarations(cardCss, ".card")[0]?.props["box-sizing"]).toBe(
      "border-box",
    );
    expect(declarations(cardCss, ".grid")[0]?.props.border).toContain(
      "1px solid",
    );
    expect(declarations(cardCss, ".bottom")[0]?.props["margin-top"]).toBe(
      "auto",
    );
    expect(
      declarations(gridCss, ".productGrid")[0]?.props["grid-template-columns"],
    ).toContain("repeat(4");
    expect(
      declarations(gridCss, ".productGrid")[0]?.props["row-gap"],
    ).toContain("36px");
    expect(
      declarations(gridCss, ".productGrid").some(
        (rule) =>
          rule.media.includes("max-width: 767px") &&
          rule.props["row-gap"] === "24px",
      ),
    ).toBe(true);
  });

  it("renders one photographic search H1 and an integrated working search command", () => {
    const page = source("app/(public)/shop/search/page.tsx");
    const hero = source(`${commerce}SearchMarketplaceHero.tsx`);
    const results = source(`${commerce}CommerceResultsLayout.tsx`);
    const command = source(`${commerce}CommerceSearchCommand.tsx`);
    const heroCss = declarations(
      `${commerce}commerce.module.css`,
      ".searchMarketplaceHero",
    )[0]?.props;
    expect(page).toContain("hideDefaultIntro");
    expect(page).toContain("<SearchMarketplaceHero");
    expect(hero.match(/<h1/g)).toHaveLength(1);
    expect(hero).toContain('appearance="hero"');
    expect(heroCss?.["background-image"]).toContain(
      "kt-home-01-world-market.webp",
    );
    expect(results).toContain(
      "!hideDefaultIntro && <div className={styles.resultsIntro}",
    );
    expect(results).toContain("<DesktopFilterRail");
    expect(results).toContain("<MobileFilterSheet");
    expect(command).toContain('role="search"');
    expect(command).toContain('aria-label="Submit search"');
    expect(command).toContain('role="listbox"');
    expect(page).not.toContain("showFilterButton");
  });

  it("uses integrated search and category circles before mobile products", () => {
    const discovery = source(`${shop}ShopMobileDiscovery.tsx`);
    const landing = source(`${shop}MarketplaceLanding.tsx`);
    expect(discovery).toContain("mobileDiscoveryField");
    expect(discovery).toContain(
      "<ShopCategoryCircleRail categories={categories}",
    );
    expect(discovery).not.toContain("products.find");
    expect(discovery).not.toContain("product.price");
    expect(landing.indexOf("<ShopMobileDiscovery")).toBeLessThan(
      landing.indexOf("<ShopProductShelf"),
    );
    expect(
      declarations(
        `${shop}shop-flagship.module.css`,
        ".mobileDiscoveryField",
      )[0]?.props["flex-direction"],
    ).toBe("column");
  });
});
