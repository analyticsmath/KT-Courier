import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import ts from "typescript";
import { describe, expect, it } from "vitest";

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
    expect(gallerySource).toContain("--pdp-media-ratio");
  });

  it("renders intrinsic, unframed media between symmetric full-height rails", () => {
    const layout = declarations(".pdpLayout");
    const frame = declarations(".pdpDesktopHeroFrame");
    const rail = declarations(".pdpIdentityRail");
    const image = declarations(".pdpDesktopImage");
    const mediaHeight = declarations(".pdpExperience").get("--pdp-desktop-image-height");

    expect(layout.get("grid-template-areas")).toBe('"identity media purchase"');
    expect(layout.get("grid-template-columns")).toMatch(/^minmax\(0, 1fr\).*minmax\(480px, min\(44vw, 720px\)\).*minmax\(0, 1fr\)$/);
    expect(layout.get("align-items")).toBe("stretch");
    expect(declarations(".pdpGalleryRoot").get("max-width")).toBe("720px");
    expect(mediaHeight).toMatch(/72svh.*700px/);
    expect(frame.get("width")).toContain("--pdp-media-ratio");
    expect(frame.get("background")).toBe("transparent");
    expect(frame.get("border")).toBe("0");
    expect(frame.get("border-radius")).toBe("0");
    expect(frame.get("margin")).toBe("0 auto");
    expect(declarations(".shopViewportRoot .pdpDesktopHeroFrame").size).toBe(0);
    expect(image.get("height")).toBe("auto");
    expect(image.get("max-height")).toBe("var(--pdp-desktop-image-height)");
    expect(image.get("object-fit")).toBe("contain");
    expect(image.get("border-radius")).toBe("0");
    expect(declarations(".pdpImageContain").get("object-fit")).toBe("contain");
    expect(rail.get("position")).toBe("relative");
    expect(rail.get("align-self")).toBe("stretch");
    expect(declarations(".pdpPurchaseRail").get("position")).toBe("relative");
    expect(declarations(".pdpIdentityPlane").get("position")).toBe("sticky");
    expect(declarations(".pdpPurchasePlane").get("position")).toBe("sticky");
    expect(declarations(".pdpIdentityPlane").get("top")).toBe("var(--pdp-sticky-center-y)");
    expect(declarations(".pdpPurchasePlane").get("transform")).toBe("translateY(-50%)");
    expect(declarations(".pdpExperience").get("--pdp-sticky-center-y")).toContain("100svh");
    expect(detailSource).toContain("ResizeObserver(updateFit)");
    expect(declarations(".pdpPurchasePlaneTall", "min-width: 1200px").get("position")).toBe("static");
  });

  it("provides a two-column compact fallback and a short-height center release", () => {
    expect(declarations(".pdpLayout", "min-width: 992px").get("grid-template-areas")).toContain('"media identity"');
    expect(declarations(".pdpLayout", "max-width: 991px").get("grid-template-areas")).toContain('"media"');
    expect(declarations(".pdpIdentityPlane", "max-height: 760px").get("transform")).toBe("none");
    expect(gallerySource).toContain("(max-width: 1199px) 55vw");
    expect(gallerySource).toContain("(max-width: 1635px) 44vw, 720px");
    expect(gallerySource).toContain("preload={index === 0}");
  });
});
