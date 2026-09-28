import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { selectCinemaStores } from "@/components/public-v2/marketplace/store-cinema-selection";
import type { MarketplaceStore } from "@/components/public-v2/marketplace/MarketplaceLanding";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const commerce = "components/public-v2/commerce/";
const shop = "components/public-v2/marketplace/";

function declarations(path: string, selector: string): Record<string, string>[] {
  const result: Record<string, string>[] = [];
  postcss.parse(source(path)).walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const props: Record<string, string> = {};
    rule.walkDecls((declaration) => { props[declaration.prop] = declaration.value; });
    result.push(props);
  });
  return result;
}

describe("Commerce precision III", () => {
  it("selects seven real featured stores in stable offer-count and name order", () => {
    const stores: MarketplaceStore[] = Array.from({ length: 9 }, (_, index) => ({
      reference: `store-${index}`, slug: `store-${index}`, name: `Store ${String(9 - index).padStart(2, "0")}`,
      publishedOfferCount: index % 2 ? 12 : 4,
    }));
    const featured = selectCinemaStores(stores, "featured");
    expect(featured).toHaveLength(7);
    expect(featured.map((store) => store.reference)).toEqual(["store-7", "store-5", "store-3", "store-1", "store-8", "store-6", "store-4"]);
    expect(selectCinemaStores(stores.slice(0, 3), "featured")).toHaveLength(3);
    expect(selectCinemaStores(stores, "directory")).toBe(stores);
  });

  it("keeps one fixed aperture while only the store media planes transform", () => {
    const cinema = source(`${shop}StoreCinema.tsx`);
    const css = source(`${shop}store-cinema.module.css`);
    expect(cinema).toContain("className={styles.focusAperture}");
    expect(cinema).toContain("className={styles.focusOutline}");
    expect(cinema).toContain("className={styles.focusLink}");
    expect(cinema).not.toContain("styles.panelOutline");
    expect(cinema).toContain("circularRelative(index, value, count)");
    expect(declarations(`${shop}store-cinema.module.css`, ".focusAperture")[0]?.transform).toBe("translate(-50%, -50%)");
    expect(declarations(`${shop}store-cinema.module.css`, ".directoryTitle")[0]?.["text-align"]).toBe("right");
    expect(declarations(`${shop}store-cinema.module.css`, ".bottomRow")[0]?.top).toContain("var(--store-focus-height) / 2");
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere|word-break:\s*break-all/);
  });

  it("uses one QuickBuy basket card for grids, shelves, and phone related products", () => {
    const card = source(`${commerce}MarketplaceProductCard.tsx`);
    const grid = source(`${commerce}ProductGrid.tsx`);
    const shelf = source(`${shop}ShopShelfProductCard.tsx`);
    const pdp = source(`${commerce}ProductDetailExperience.tsx`);
    expect(card).toContain("<QuickBuySheet");
    expect(card).toContain("Quick add ${product.title}");
    expect(card).toContain('data-kt-sticky-mode="VIEW"');
    expect(card).not.toContain("View item");
    expect(grid).toContain('<MarketplaceProductCard variant="grid"');
    expect(shelf).toContain('variant="shelf"');
    expect(pdp).toContain("<MarketplaceProductRail");
    expect(source(`${commerce}MarketplaceProductRail.tsx`)).toContain('variant="related"');
    expect(declarations(`${commerce}commerce.module.css`, ".productGrid")[0]?.["grid-template-columns"]).toContain("repeat(4");
    expect(declarations(`${commerce}commerce.module.css`, ".shopViewportRoot .productGrid").at(-1)?.["grid-template-columns"]).toBe("repeat(2, minmax(0, 1fr))");
    expect(declarations(`${commerce}marketplace-product-card.module.css`, ".related").at(-1)?.flex).toBe("0 0 calc((100vw - 44px) / 2)");
  });

  it("shows real circular PDP thumbnails and keeps navigation above the purchase dock", () => {
    const gallery = source(`${commerce}ProductMediaGallery.tsx`);
    const nav = source("components/public-v3/navigation/MobileNavigation.tsx");
    const navCss = source("components/public-v3/navigation/mobile-navigation.module.css");
    const pdpCss = source(`${commerce}commerce.module.css`);
    expect(gallery).toContain("pdpMobileThumbnailRail");
    expect(gallery).toContain("Show product image ${i + 1} of ${gallery.length}");
    expect(gallery).toContain('aria-current={i === activeIndex ? "true" : undefined}');
    expect(gallery).toContain("onClick={() => scrollToSlide(i)}");
    expect(gallery).not.toContain("pdpMobileGalleryDots");
    expect(nav).not.toContain("if (isProductPage) return null");
    expect(nav).toContain('pathname.startsWith("/checkout")');
    expect(nav).toContain('aria-label="Mobile app navigation"');
    expect(nav).toContain('aria-current={isActive ? "page" : undefined}');
    expect(nav).toContain("styles.cradle");
    expect(nav).toContain("styles.icon");
    expect(navCss).toContain("height: var(--kt-mobile-nav-height)");
    expect(source("components/public-v3/foundation/tokens.css")).toContain("--kt-commerce-mobile-nav-clearance");
    expect(pdpCss).toContain("--shop-bottom-nav-clearance: var(--kt-commerce-mobile-nav-clearance)");
    expect(pdpCss).toContain("height: clamp(440px, 64svh, 650px)");
  });

  it("builds mobile discovery from market photography and live category circles", () => {
    const discovery = source(`${shop}ShopMobileDiscovery.tsx`);
    const landing = source(`${shop}MarketplaceLanding.tsx`);
    const css = source(`${shop}shop-flagship.module.css`);
    expect(landing).toContain("<ShopMobileDiscovery categories={categories} />");
    expect(discovery).not.toContain("products.find(");
    expect(discovery).toContain("/media/public/home/kt-home-01-world-market.webp");
    expect(discovery).toContain("<CommerceSearchCommand appearance=\"shop\" />");
    expect(discovery).toContain("<ShopCategoryCircleRail categories={categories} />");
    expect(css).toContain("background: var(--kt-cobalt-deep)");
    expect(css).toContain("min(66vw, 245px)");
  });
});
