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
    expect(desktop).toContain("pdpDesktopMediaIndex");
    expect(jsxNodes(galleryAst, "section")).toHaveLength(1);
    expect(gallerySource).toContain('aria-label="Product image gallery"');
    expect(declarations(".pdpDesktopGalleryStage").get("flex-direction")).toBe("column");
    expect(declarations(".pdpMobileGalleryScroller", "max-width: 991px").get("scroll-snap-type")).toBe("x mandatory");
    expect(declarations(".pdpMobileStickyBar", "max-width: 768px").get("position")).toBe("fixed");
    const desktopFigure = jsxNodes(galleryAst, "figure")[0]?.getText(galleryAst);
    expect(desktopFigure).toContain("width={media.width}");
    expect(desktopFigure).toContain("height={media.height}");
    expect(desktopFigure).not.toMatch(/\sfill(?:\s|\n)/);
    expect(desktopFigure).toContain("className={styles.pdpDesktopImage}");
    expect(desktopFigure).toContain("className={styles.pdpDesktopMediaShell}");
    expect(gallerySource).not.toContain("--pdp-media-ratio");
  });

  it("uses a transparent maximum-fit media stage between symmetric full-height rails", () => {
    const layout = declarations(".pdpLayout");
    const wideLayout = declarations(".pdpLayout", "min-width: 1200px");
    const frame = declarations(".pdpDesktopHeroFrame");
    const rail = declarations(".pdpIdentityRail");
    const image = declarations(".pdpDesktopImage");
    const mediaHeight = declarations(".shopViewportRoot .pdpExperience", "min-width: 1200px").get("--pdp-desktop-media-height");

    expect(layout.get("grid-template-areas")).toBe('"identity media purchase"');
    expect(wideLayout.get("grid-template-columns")).toBe("minmax(0, 1fr) minmax(600px, min(48vw, 820px)) minmax(0, 1fr)");
    expect(layout.get("align-items")).toBe("stretch");
    expect(declarations(".pdpGalleryRoot", "min-width: 1200px").get("max-width")).toBe("820px");
    expect(mediaHeight).toMatch(/78svh.*760px.*72px/);
    expect(declarations(".shopViewportRoot .pdpExperience", "min-width: 1200px").get("width"))
      .toBe("min(calc(100vw - 64px), 112rem)");
    expect(frame.get("width")).toBe("100%");
    expect(frame.get("height")).toBe("var(--pdp-desktop-media-height)");
    expect(frame.get("display")).toBe("grid");
    expect(frame.get("place-items")).toBe("center");
    expect(frame.get("aspect-ratio")).toBeUndefined();
    expect(frame.get("background")).toBe("transparent");
    expect(frame.get("border")).toBe("0");
    expect(frame.get("border-radius")).toBe("0");
    expect(frame.get("overflow")).toBe("visible");
    expect(declarations(".shopViewportRoot .pdpDesktopHeroFrame").size).toBe(0);
    expect(declarations(".pdpDesktopMediaShell").get("width")).toBe("100%");
    expect(declarations(".pdpDesktopMediaShell").get("height")).toBe("100%");
    expect(declarations(".pdpDesktopMediaShell").get("position")).toBe("relative");
    expect(image.get("width")).toBe("100%");
    expect(image.get("height")).toBe("100%");
    expect(image.get("object-fit")).toBe("contain");
    expect(image.get("border-radius")).toBe("0");
    expect(declarations(".pdpImageContain").get("object-fit")).toBe("contain");
    expect(rail.get("position")).toBe("relative");
    expect(rail.get("align-self")).toBe("stretch");
    expect(declarations(".pdpPurchaseRail").get("position")).toBe("relative");
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
    expect(gallerySource).toContain("(max-width: 1708px) 48vw, 820px");
    expect(gallerySource).toContain("preload={index === 0}");
  });
});
