import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { computeCenteredStickyPlacement } from "@/components/public-v2/commerce/pdp-geometry";

const root = process.cwd();
const detailSource = readFileSync(
  join(root, "components/public-v2/commerce/ProductDetailExperience.tsx"),
  "utf8"
);
const gallerySource = readFileSync(
  join(root, "components/public-v2/commerce/ProductMediaGallery.tsx"),
  "utf8"
);
const css = postcss.parse(
  readFileSync(join(root, "components/public-v2/commerce/commerce.module.css"), "utf8")
);
const detailAst = ts.createSourceFile("ProductDetailExperience.tsx", detailSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const galleryAst = ts.createSourceFile("ProductMediaGallery.tsx", gallerySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function jsxNodes(source: ts.SourceFile, tagName: string) {
  const matches: ts.Node[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === tagName) ||
      (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === tagName)
    ) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return matches;
}

function elementByClass(className: string) {
  const element = [...jsxNodes(detailAst, "section"), ...jsxNodes(detailAst, "div")].find((node) => {
    if (!ts.isJsxElement(node)) return false;
    return node.openingElement.attributes.properties.some((attribute) =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(detailAst) === "className" &&
      attribute.initializer?.getText(detailAst).includes(`styles.${className}`)
    );
  });
  expect(element, `${className} region exists`).toBeDefined();
  return element as ts.JsxElement;
}

function region(className: string) {
  return elementByClass(className).getText(detailAst);
}

function declarations(selector: string, media?: string) {
  const values = new Map<string, string>();
  css.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    if (media && !(rule.parent?.type === "atrule" && rule.parent.params.includes(media))) return;
    if (!media && rule.parent?.type === "atrule") return;
    rule.walkDecls((declaration) => {
      values.set(declaration.prop, declaration.value);
    });
  });
  return values;
}

describe("PDP three-column presentation contract", () => {
  it("separates identity, gallery, and transaction content without duplicating the H1 or gallery", () => {
    const identity = region("pdpIdentityPlane");
    const purchase = region("pdpPurchasePlane");

    expect(jsxNodes(detailAst, "h1")).toHaveLength(1);
    expect(identity).toContain("pdp-product-title");
    expect(identity).toContain("product.brandName");
    expect(identity).toContain("product.shortDescription");
    expect(identity).not.toMatch(/SellerSelector|pdpPriceRow|pdpActionsBlock/);
    expect(purchase).toMatch(/pdpPriceRow[\s\S]*SellerSelector[\s\S]*variantSelectorBlock[\s\S]*pdpModifiersContainer[\s\S]*pdpActionsBlock/);
    expect(purchase).toContain('data-kt-action="add-to-cart"');
    expect(purchase).toContain('data-kt-action="buy-now"');
    expect(jsxNodes(detailAst, "ProductMediaGallery")).toHaveLength(1);
    expect(detailSource).not.toContain("pdpSidePlanes");
    const layout = elementByClass("pdpLayout");
    const roles = layout.children
      .filter((child): child is ts.JsxElement | ts.JsxSelfClosingElement =>
        ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)
      )
      .map((child) => ts.isJsxSelfClosingElement(child)
        ? child.tagName.getText(detailAst)
        : child.openingElement.attributes.getText(detailAst));
    expect(roles).toHaveLength(3);
    expect(roles[0]).toContain("styles.pdpIdentityRail");
    expect(roles[1]).toBe("ProductMediaGallery");
    expect(roles[2]).toContain("styles.pdpPurchaseRail");
  });

  it("keeps each desktop image in vertical document flow and the mobile snap gallery intact", () => {
    const desktop = gallerySource.slice(gallerySource.indexOf('className={styles.pdpDesktopGalleryStage}'));
    expect(desktop).toContain("gallery.map((media, index)");
    expect(desktop).toContain("className={styles.pdpDesktopHeroFrame}");
    expect(desktop).toContain('index === 0 ? "product-media"');
    expect(desktop).toContain("<DesktopPdpMediaCard");
    expect(jsxNodes(galleryAst, "section")).toHaveLength(1);
    expect(gallerySource).toContain('aria-label="Product image gallery"');
    expect(declarations(".pdpDesktopGalleryStage").get("flex-direction")).toBe("column");
    expect(declarations(".pdpMobileGalleryScroller", "max-width: 991px").get("scroll-snap-type")).toBe("x mandatory");
    expect(declarations(".pdpMobileStickyBar", "max-width: 768px").get("position")).toBe("fixed");
    const desktopFigure = jsxNodes(galleryAst, "figure")[0]?.getText(galleryAst);
    expect(desktopFigure).toContain("media={media}");
    expect(desktopFigure).toContain("total={gallery.length}");
    expect(gallerySource).toContain("width={imageWidth}");
    expect(gallerySource).toContain("height={imageHeight}");
    expect(gallerySource).toContain("preload={index === 0}");
    expect(gallerySource).not.toMatch(/<Image[^>]*\sfill(?:\s|\n)[^>]*pdpDesktopImage/s);
  });

  it("uses source-ratio slabs with restrained depth and a naturally sized gallery flow", () => {
    const layout = declarations(".pdpLayout");
    const wideLayout = declarations(".pdpLayout", "min-width: 1200px");
    const frame = declarations(".pdpDesktopHeroFrame");
    const card = declarations(".pdpDesktopMediaCard");
    const stage = declarations(".pdpDesktopGalleryStage");
    const rail = declarations(".pdpIdentityRail");
    const image = declarations(".pdpDesktopImage");
    const mediaHeight = declarations(".shopViewportRoot .pdpExperience", "min-width: 1200px").get("--pdp-desktop-media-height");

    expect(layout.get("grid-template-areas")).toBe('"identity media purchase"');
    expect(wideLayout.get("grid-template-columns")).toBe("minmax(0, 1fr) minmax(560px, min(45vw, 780px)) minmax(0, 1fr)");
    expect(layout.get("align-items")).toBe("stretch");
    expect(declarations(".pdpGalleryRoot", "min-width: 1200px").get("max-width")).toBe("780px");
    expect(mediaHeight).toMatch(/74svh.*720px.*92px/);
    expect(declarations(".shopViewportRoot .pdpExperience", "min-width: 1200px").get("width"))
      .toBe("min(calc(100vw - 64px), 112rem)");
    expect(frame.get("width")).toBe("100%");
    expect(frame.get("height")).toBe("auto");
    expect(frame.get("display")).toBe("flex");
    expect(frame.get("justify-content")).toBe("center");
    expect(frame.get("aspect-ratio")).toBeUndefined();
    expect(frame.get("background")).toBe("transparent");
    expect(frame.get("border")).toBe("0");
    expect(frame.get("border-radius")).toBe("0");
    expect(frame.get("box-shadow")).toBeUndefined();
    expect(frame.get("overflow")).toBe("visible");
    expect(declarations(".pdpGalleryRoot").get("overflow")).toBe("visible");
    expect(stage.get("overflow")).toBe("visible");
    expect(stage.get("gap")).toBe("clamp(28px, 2vw, 36px)");
    expect(declarations(".shopViewportRoot .pdpDesktopGalleryStage").has("gap")).toBe(false);
    expect(card.get("width")).toContain("var(--pdp-desktop-media-height) * var(--pdp-media-ratio-number)");
    expect(card.get("aspect-ratio")).toBe("var(--pdp-media-ratio-number)");
    expect(card.get("margin-inline")).toBe("auto");
    expect(card.get("overflow")).toBe("hidden");
    expect(card.get("border-radius")).toBe("12px");
    expect(card.get("border")).toContain("rgb(11 13 15 / 0.07)");
    expect(card.get("box-shadow")?.match(/rgb\(11 13 15/g)).toHaveLength(3);
    expect(card.get("padding")).toBeUndefined();
    expect(gallerySource).toContain('"--pdp-media-ratio-number": ratio');
    expect(gallerySource).toContain("const ratio = imageWidth / imageHeight");
    expect(gallerySource).toContain("Number.isFinite(media.width)");
    expect(gallerySource).toContain("Number.isFinite(media.height)");
    expect(gallerySource).toContain("hasValidDimensions ? media.width : 1");
    expect(gallerySource).toContain("hasValidDimensions ? media.height : 1");
    expect(image.get("width")).toBe("100%");
    expect(image.get("height")).toBe("100%");
    expect(image.get("object-fit")).toBe("cover");
    expect(declarations(".pdpDesktopImageUnknownRatio").get("object-fit")).toBe("contain");
    expect(image.get("padding")).toBe("0");
    expect(image.get("border-radius")).toBe("0");
    expect(declarations(".pdpImageContain").get("object-fit")).toBe("contain");
    expect(rail.get("position")).toBe("relative");
    expect(rail.get("align-self")).toBe("stretch");
    expect(declarations(".pdpPurchaseRail").get("position")).toBe("relative");
  });

  it("keeps each counter inside its own moving slab and limits scroll motion", () => {
    const card = jsxNodes(galleryAst, "motion.div")[0]?.getText(galleryAst);
    const counter = declarations(".pdpDesktopMediaIndex");
    expect(card).toContain("className={styles.pdpDesktopMediaCard}");
    expect(card).toContain("className={styles.pdpDesktopMediaIndex}");
    expect(card).toContain("{String(index + 1).padStart(2, \"0\")}");
    expect(card).toContain("{String(total).padStart(2, \"0\")}");
    expect(counter.get("position")).toBe("absolute");
    expect(counter.get("right")).toBe("14px");
    expect(counter.get("bottom")).toBe("14px");
    expect(gallerySource).toContain("useScroll({");
    expect(gallerySource).toContain("useSpring(scrollYProgress");
    expect(gallerySource).toContain("useTransform(smoothProgress");
    expect(gallerySource).toContain("useReducedMotion()");
    expect(gallerySource).toContain("reduceMotion ? [1, 1, 1] : [0.988, 1, 0.988]");
    expect(gallerySource).toContain("reduceMotion ? [0, 0, 0] : [12, 0, -12]");
    expect(gallerySource).not.toMatch(/useScroll[\s\S]*setState\(/);
    expect(declarations(".pdpDesktopMediaCard", "max-width: 1199px").get("transform")).toBe("none");
  });

  it("measures each rail and plane independently and applies both placement values", () => {
    expect(region("pdpIdentityRail")).toContain("ref={identityRailRef}");
    expect(region("pdpPurchaseRail")).toContain("ref={purchaseRailRef}");
    expect(detailSource).toContain("identityRail.getBoundingClientRect().top");
    expect(detailSource).toContain("purchaseRail.getBoundingClientRect().top");
    expect(detailSource).toContain("identityRail.getBoundingClientRect().top + window.scrollY");
    expect(detailSource).toContain("purchaseRail.getBoundingClientRect().top + window.scrollY");
    expect(detailSource).toContain("identity.getBoundingClientRect().height");
    expect(detailSource).toContain("purchase.getBoundingClientRect().height");
    expect(detailSource).toContain("observer.observe(identity)");
    expect(detailSource).toContain("observer.observe(purchase)");
    expect(detailSource).toContain("document.fonts?.ready.then(updatePlacement)");
    expect(detailSource).toContain('window.addEventListener("resize", updatePlacement)');
    expect(region("pdpIdentityPlane")).toContain("planePlacement.identity.stickyTop");
    expect(region("pdpIdentityPlane")).toContain("planePlacement.identity.initialOffset");
    expect(region("pdpPurchasePlane")).toContain("planePlacement.purchase.stickyTop");
    expect(region("pdpPurchasePlane")).toContain("planePlacement.purchase.initialOffset");
    expect(declarations(".pdpIdentityPlane").get("position")).toBe("sticky");
    expect(declarations(".pdpPurchasePlane").get("position")).toBe("sticky");
    expect(declarations(".pdpIdentityPlane").get("top")).toContain("--pdp-plane-sticky-top");
    expect(declarations(".pdpIdentityPlane", "min-width: 1200px").get("margin-top"))
      .toBe("var(--pdp-plane-initial-offset, 0px)");
    expect(declarations(".pdpPurchasePlane", "min-width: 1200px").get("margin-top"))
      .toBe("var(--pdp-plane-initial-offset, 0px)");
    expect(declarations(".pdpIdentityPlaneTall", "min-width: 1200px").get("overflow-y")).toBe("auto");
    expect(declarations(".pdpPurchasePlaneTall", "min-width: 1200px").get("position")).toBeUndefined();
    expect(detailSource).not.toContain("translateY(-50%)");
  });

  it("centers independent heights from first placement through symmetric growth", () => {
    const base = { viewportHeight: 924, headerHeight: 66, railViewportTop: 150 };
    const identity = computeCenteredStickyPlacement({ ...base, planeHeight: 190 });
    const purchase = computeCenteredStickyPlacement({ ...base, planeHeight: 380 });
    const longerIdentity = computeCenteredStickyPlacement({ ...base, planeHeight: 290 });
    const longerPurchase = computeCenteredStickyPlacement({ ...base, planeHeight: 440 });
    expect(identity).toEqual({ viewportCenter: 495, stickyTop: 400, initialOffset: 250, tooTall: false });
    expect(purchase).toEqual({ viewportCenter: 495, stickyTop: 305, initialOffset: 155, tooTall: false });
    expect(longerIdentity).toEqual({ viewportCenter: 495, stickyTop: 350, initialOffset: 200, tooTall: false });
    expect(longerPurchase.stickyTop).toBe(275);
    for (const [placement, height] of [[identity, 190], [purchase, 380], [longerIdentity, 290], [longerPurchase, 440]] as const) {
      expect(base.railViewportTop + placement.initialOffset).toBe(placement.stickyTop);
      expect(placement.stickyTop + height / 2).toBe(placement.viewportCenter);
    }
    expect(computeCenteredStickyPlacement({ ...base, planeHeight: 850 }))
      .toEqual({ viewportCenter: 495, stickyTop: 82, initialOffset: 0, tooTall: true });
  });

  it("preserves compact and mobile layouts", () => {
    expect(declarations(".pdpLayout", "min-width: 992px").get("grid-template-areas")).toContain('"media identity"');
    expect(declarations(".pdpLayout", "max-width: 991px").get("grid-template-areas")).toContain('"media"');
    expect(declarations(".pdpIdentityPlane", "min-width: 992px").get("position")).toBe("static");
    expect(declarations(".pdpIdentityPlane", "max-width: 991px").get("position")).toBe("static");
    expect(gallerySource).toContain("(max-width: 1199px) 55vw");
    expect(gallerySource).toContain("(max-width: 1734px) 45vw, 780px");
    expect(gallerySource).toContain("preload={index === 0}");
  });
});
