import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const shop = "components/public-v2/marketplace/";
const css = postcss.parse(source(`${shop}shop-flagship.module.css`));
const pdpCss = postcss.parse(source("components/public-v2/commerce/commerce.module.css"));
const rules = (root: postcss.Root, selector: string) => {
  const found: Array<{ media: string; props: Record<string, string> }> = [];
  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const props: Record<string, string> = {};
    rule.walkDecls((declaration) => { props[declaration.prop] = declaration.value; });
    found.push({ media: rule.parent?.type === "atrule" ? rule.parent.params.replace(/[()]/g, "") : "", props });
  });
  return found;
};

describe("Shop flagship contract", () => {
  it("loads five grouped category shelves on the server with bounded searches", () => {
    const page = source("app/(public)/shop/page.tsx");
    const service = source("lib/services/storefront-catalog.service.ts");
    expect(page).toContain("selectFeaturedMarketplaceCategories(home.categories)");
    expect(page).toContain("await getStorefrontShopShelves(categories.map");
    expect(service).toContain("[...new Set(categoryPaths)].slice(0, 5)");
    expect(service).toContain("Promise.all(paths.map");
    expect(service).toContain("new StorefrontSearchService(new PostgresStorefrontSearchAdapter())");
    expect(service).toContain(".search({ category: path, pageSize: 10 })");
  });

  it("runs a finite interruptible Motion film and keeps the real search and five category portals", () => {
    const film = source(`${shop}ShopCategoryFilm.tsx`);
    const command = source(`${shop}ShopBrowseCommand.tsx`);
    const circles = source(`${shop}ShopCategoryCircleRail.tsx`);
    expect(film).toContain('from "motion/react"');
    expect(film).toContain("useReducedMotion");
    expect(film).toContain("Skip intro");
    expect(film).toContain('event.key === "Escape"');
    expect(film).toContain('window.addEventListener("wheel"');
    expect(film).toContain('window.addEventListener("touchmove"');
    expect(film).toContain("isMobile ? 2900 : 4750");
    expect(film).not.toContain("setInterval");
    expect(rules(css, ".film")[0]?.props["grid-template-columns"]).toBe("1fr 1fr");
    expect(rules(css, ".film").some((rule) => rule.media === "max-width: 767px" && rule.props["grid-template-rows"] === "58% 42%")).toBe(true);
    expect(command).toContain("<h1 id=\"shop-title\">Shop</h1>");
    expect(command).toContain("<CommerceSearchCommand />");
    expect(circles).toContain("categories.map");
    expect(circles).toContain("marketplaceCategoryHref(category.path)");
    expect(circles).toContain("categoryTransitionId(category.path)");
    expect(circles).toContain("Explore all categories");
  });

  it("shows nonempty manual shelves with Quick Buy and ends with storefronts", () => {
    const landing = source(`${shop}MarketplaceLanding.tsx`);
    const shelf = source(`${shop}ShopProductShelf.tsx`);
    const card = source(`${shop}ShopShelfProductCard.tsx`);
    const stores = source(`${shop}StorefrontStack.tsx`);
    expect(landing).toContain('title="New in the Market"');
    expect(landing).toContain("shelves.map");
    expect(landing.lastIndexOf("<StorefrontStack")).toBeGreaterThan(landing.lastIndexOf("<ShopProductShelf"));
    expect(landing).not.toContain("<ProductGrid");
    expect(shelf).toContain("if (!products.length) return null");
    expect(shelf).toContain("scrollBy");
    expect(shelf).not.toContain("setInterval");
    expect(card).toContain("<QuickBuySheet");
    expect(card).toContain("Quick add ${product.title}");
    expect(card).toContain("product-${product.productReference}");
    expect(rules(css, ".productTrack")[0]?.props["scroll-snap-type"]).toBe("x proximity");
    expect(stores).toContain("b.publishedOfferCount - a.publishedOfferCount");
    expect(stores).toContain(".slice(0, 5)");
    expect(stores).toContain("inert={!mobile && !isActive}");
    expect(rules(css, ".storeStage").some((rule) => rule.media === "max-width: 767px" && rule.props["scroll-snap-type"] === "x mandatory")).toBe(true);
  });
});

describe("phone PDP contract", () => {
  it("keeps icon-only controls, edge-to-edge snap media, one action dock, and disclosure/related rails", () => {
    const detail = source("components/public-v2/commerce/ProductDetailExperience.tsx");
    const gallery = source("components/public-v2/commerce/ProductMediaGallery.tsx");
    const info = source("components/public-v2/commerce/ProductInformation.tsx");
    expect(detail).toContain('aria-label="Go back"');
    expect(detail).toContain('aria-label="Cart"');
    expect(detail).not.toContain("<span>Back</span>");
    expect(detail).not.toContain("\n          Cart\n");
    expect(gallery).toContain("pdpMobileGalleryScroller");
    expect(gallery).toContain("scrollToSlide");
    expect(gallery).toContain("pdpImagePortrait");
    expect(rules(pdpCss, ".shopViewportRoot .pdpGalleryRoot").some((rule) => rule.media === "max-width: 767px" && rule.props.width === "100vw")).toBe(true);
    expect(rules(pdpCss, ".pdpActionButtons").some((rule) => rule.media === "max-width: 767px" && rule.props.display === "none")).toBe(true);
    expect(rules(pdpCss, ".shopViewportRoot .pdpMobileStickyBar").some((rule) => rule.media === "max-width: 767px" && rule.props.bottom === "var(--shop-bottom-nav-clearance)")).toBe(true);
    expect(rules(pdpCss, ".pdpActionButtons").some((rule) => rule.media === "" && rule.props.display === "grid")).toBe(true);
    expect(detail).toContain("pdpRelatedMobileTrack");
    expect(info).toContain("Product details & specifications");
    expect(info).toContain("Delivery & fulfilment");
    expect(info).toContain("Seller information");
  });
});
