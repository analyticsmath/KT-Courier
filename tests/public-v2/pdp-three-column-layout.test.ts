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

function region(className: string) {
  const element = [...jsxNodes(detailAst, "section"), ...jsxNodes(detailAst, "div")].find((node) => {
    if (!ts.isJsxElement(node)) return false;
    return node.openingElement.attributes.properties.some((attribute) =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(detailAst) === "className" &&
      attribute.initializer?.getText(detailAst).includes(`styles.${className}`)
    );
  });
  expect(element, `${className} region exists`).toBeDefined();
  return element!.getText(detailAst);
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
    expect(detailSource.indexOf("<ProductMediaGallery")).toBeLessThan(detailSource.indexOf("className={styles.pdpSidePlanes}"));
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
  });

  it("centers a capped, contained media stage between symmetric sticky rails", () => {
    const layout = declarations(".pdpLayout");
    const frame = declarations(".pdpDesktopHeroFrame");
    const rail = declarations(".pdpIdentityRail");
    const mediaHeight = declarations(".pdpExperience").get("--pdp-desktop-media-height");

    expect(layout.get("grid-template-areas")).toBe('"identity media purchase"');
    expect(layout.get("grid-template-columns")).toMatch(/^minmax\(0, 1fr\).*minmax\(440px, min\(40vw, 640px\)\).*minmax\(0, 1fr\)$/);
    expect(declarations(".pdpGalleryRoot").get("max-width")).toBe("640px");
    expect(mediaHeight).toMatch(/62svh.*640px/);
    expect(frame.get("height")).toBe("var(--pdp-desktop-media-height)");
    expect(frame.get("max-height")).toBe("var(--pdp-desktop-media-height)");
    expect(frame.get("min-height")).toBe("0");
    expect(frame.get("aspect-ratio")).toBe("auto");
    expect(declarations(".pdpImageContain").get("object-fit")).toBe("contain");
    expect(declarations(".shopViewportRoot .pdpImageContain").get("object-fit")).toBe("contain");
    expect(rail.get("position")).toBe("sticky");
    expect(declarations(".pdpPurchaseRail").get("position")).toBe("sticky");
    expect(declarations(".pdpIdentityRail").get("min-height")).toBe("var(--pdp-desktop-media-height)");
  });

  it("provides a two-column compact fallback and short-height rail release", () => {
    expect(declarations(".pdpLayout", "min-width: 992px").get("grid-template-areas")).toBe('"media side"');
    expect(declarations(".pdpLayout", "max-width: 991px").get("grid-template-areas")).toContain('"media"');
    expect(declarations(".pdpPurchaseRail", "max-height: 760px").get("position")).toBe("static");
    expect(gallerySource).toContain("(max-width: 1199px) 55vw");
    expect(gallerySource).toContain("(max-width: 1599px) 42vw, 640px");
    expect(gallerySource).toContain("preload={index === 0}");
  });
});
