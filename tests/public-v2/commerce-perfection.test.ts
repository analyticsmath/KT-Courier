import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  humanizeFulfilmentMode,
  humanizeCondition,
  humanizeAvailability,
  formatCommercePrice,
  humanizeAttributeName,
  aggregateCategoryCount,
} from "@/lib/public-marketplace/commerce-presentation";
import { storefrontCategoryMediaSrc } from "@/lib/storefront/category-media";

describe("Commerce Perfection Pass: Presentation & Utilities", () => {
  describe("humanizeFulfilmentMode", () => {
    it("humanizes fulfilment modes correctly", () => {
      expect(humanizeFulfilmentMode("COURIER_DELIVERY")).toBe(
        "Courier delivery",
      );
      expect(humanizeFulfilmentMode("STORE_PICKUP")).toBe("Store pickup");
      expect(humanizeFulfilmentMode("PICKUP_AND_DELIVERY")).toBe(
        "Pickup & delivery",
      );
      expect(humanizeFulfilmentMode(null)).toBe("Standard delivery");
    });
  });

  describe("humanizeCondition", () => {
    it("humanizes condition codes correctly", () => {
      expect(humanizeCondition("NEW")).toBe("New");
      expect(humanizeCondition("REFURBISHED")).toBe("Refurbished");
      expect(humanizeCondition("RECONDITIONED")).toBe("Reconditioned");
      expect(humanizeCondition("USED")).toBe("Pre-owned");
      expect(humanizeCondition(null)).toBe("New");
    });
  });

  describe("humanizeAvailability", () => {
    it("humanizes availability states correctly", () => {
      expect(humanizeAvailability("IN_STOCK")).toEqual({
        label: "In stock",
        isAvailable: true,
        isLowStock: false,
      });
      expect(humanizeAvailability("LOW_STOCK")).toEqual({
        label: "Low stock",
        isAvailable: true,
        isLowStock: true,
      });
      expect(humanizeAvailability("OUT_OF_STOCK")).toEqual({
        label: "Out of stock",
        isAvailable: false,
        isLowStock: false,
      });
      expect(humanizeAvailability("DISCONTINUED")).toEqual({
        label: "Discontinued",
        isAvailable: false,
        isLowStock: false,
      });
    });
  });

  describe("formatCommercePrice", () => {
    it("formats prices in ZAR currency", () => {
      const formatted = formatCommercePrice("149.99");
      expect(formatted).toContain("149");
    });
  });

  describe("humanizeAttributeName", () => {
    it("converts snake_case and kebab-case to Title Case", () => {
      expect(humanizeAttributeName("organic_certified")).toBe(
        "Organic Certified",
      );
      expect(humanizeAttributeName("pack-size")).toBe("Pack Size");
      expect(humanizeAttributeName("brandName")).toBe("Brand Name");
    });
  });

  describe("aggregateCategoryCount", () => {
    it("aggregates parent and descendant product counts accurately", () => {
      const categories = [
        { path: "/groceries", productCount: 0 },
        { path: "/groceries/fresh-produce", productCount: 12 },
        { path: "/groceries/bakery", productCount: 8 },
        { path: "/fashion", productCount: 15 },
      ];
      const count = aggregateCategoryCount("/groceries", categories);
      expect(count).toBe(20);
    });

    it("does not count neighboring category names as descendants", () => {
      expect(
        aggregateCategoryCount("food", [
          { path: "food", productCount: 1 },
          { path: "food/tea", productCount: 2 },
          { path: "food-dining", productCount: 20 },
        ]),
      ).toBe(3);
    });

    it("handles trailing and leading slash variants and direct count", () => {
      const categories = [
        { path: "groceries", productCount: 5 },
        { path: "groceries/pantry", productCount: 7 },
      ];
      const count = aggregateCategoryCount("/groceries/", categories);
      expect(count).toBe(12);
    });
  });

  describe("Category Media Curated Derivatives", () => {
    it("resolves the 5 Featured Marketplace Worlds to their authoritative curated Cloudinary assets", () => {
      const grocerySrc = storefrontCategoryMediaSrc("CMA-CAT-GROCERIES");
      expect(grocerySrc).toBeDefined();
      expect(grocerySrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/groceries.webp",
      );

      const fashionSrc = storefrontCategoryMediaSrc("CMA-CAT-FASHION");
      expect(fashionSrc).toBeDefined();
      expect(fashionSrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/fashion.webp",
      );

      const diningSrc = storefrontCategoryMediaSrc("CMA-CAT-FOOD-DINING");
      expect(diningSrc).toBeDefined();
      expect(diningSrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/food-dining.webp",
      );

      const homeSrc = storefrontCategoryMediaSrc("CMA-CAT-HOME-LIVING");
      expect(homeSrc).toBeDefined();
      expect(homeSrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/home-living.webp",
      );

      const pharmacySrc = storefrontCategoryMediaSrc("CMA-CAT-PHARMACY");
      expect(pharmacySrc).toBeDefined();
      expect(pharmacySrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/pharmacy.webp",
      );
    });

    it("resolves subcategories to their dedicated curated photography", () => {
      const accessoriesSrc = storefrontCategoryMediaSrc("CMA-CAT-ACCESSORIES");
      expect(accessoriesSrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/accessories.webp",
      );

      const footwearSrc = storefrontCategoryMediaSrc("CMA-CAT-FOOTWEAR");
      expect(footwearSrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/footwear.webp",
      );

      const decorSrc = storefrontCategoryMediaSrc("CMA-CAT-DECOR");
      expect(decorSrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/decor.webp",
      );

      const personalCareSrc = storefrontCategoryMediaSrc(
        "CMA-CAT-PERSONAL-CARE",
      );
      expect(personalCareSrc).toBe(
        "https://res.cloudinary.com/q8gbzml2/image/upload/f_auto,q_auto,c_fill,g_auto,w_1600,h_1000/kt-courier/category-2026/personal-care.webp",
      );
    });
  });

  describe("CSS & Typography Invariants", () => {
    const root = process.cwd();
    const cssContent = readFileSync(
      join(root, "components/public-v2/commerce/commerce.module.css"),
      "utf8",
    );

    it("enforces line-clamp 3, line-height 1.34, and min-height 0 for productTileTitle", () => {
      expect(cssContent).toContain("-webkit-line-clamp: 3");
      expect(cssContent).toContain("line-height: 1.34");
      expect(cssContent).toContain("min-height: 0");
    });

    it("strictly forbids hover underline in commerce CSS", () => {
      // Must not have text-decoration: underline or :hover { text-decoration: underline }
      expect(cssContent).not.toMatch(
        /:hover[^{]*\{[^}]*text-decoration:\s*underline/,
      );
      expect(cssContent).not.toMatch(/text-decoration:\s*underline/);
    });
  });

  describe("Refinement Pass II: Architecture & Invariants", () => {
    const root = process.cwd();
    const cssContent = readFileSync(
      join(root, "components/public-v2/commerce/commerce.module.css"),
      "utf8",
    );
    const categoryFieldContent = readFileSync(
      join(root, "components/public-v2/commerce/CategoryDiscoveryField.tsx"),
      "utf8",
    );
    const mobileSheetContent = readFileSync(
      join(root, "components/public-v2/commerce/MobileFilterSheet.tsx"),
      "utf8",
    );
    const desktopRailContent = readFileSync(
      join(root, "components/public-v2/commerce/DesktopFilterRail.tsx"),
      "utf8",
    );
    const manifestJson: Array<{
      publicReference: string;
      provider: string;
      assetUrl: string;
    }> = JSON.parse(
      readFileSync(join(root, "scripts/demo/media/manifest.json"), "utf8"),
    );

    it("verifies CategoryDiscoveryField eyebrow has been completely removed", () => {
      expect(categoryFieldContent).not.toContain("Browse the marketplace");
    });

    it("verifies MobileFilterSheet guards against desktop viewports and omits description", () => {
      expect(mobileSheetContent).toContain("max-width: 1023px");
      expect(mobileSheetContent).not.toMatch(/description="Choose filters/);
    });

    it("verifies DesktopFilterRail places facet groups before price range form", () => {
      const facetIndex = desktopRailContent.indexOf("facets.map");
      const priceIndex = desktopRailContent.indexOf("desktopPriceForm");
      expect(facetIndex).toBeGreaterThan(-1);
      expect(priceIndex).toBeGreaterThan(-1);
      expect(facetIndex).toBeLessThan(priceIndex);
    });

    it("verifies filterMobileSheetDialog is strictly hidden on desktop (>= 1024px)", () => {
      expect(cssContent).toMatch(
        /@media\s*\(\s*min-width:\s*1024px\s*\)\s*\{[^{}]*\.filterMobileSheetDialog\s*\{[^}]*display:\s*none\s*!important;/,
      );
    });

    it("verifies commerce CSS has eliminated duplicate legacy filterSheetBody and filterSheetFooter", () => {
      const bodyMatches = cssContent.match(/\.filterSheetBody\s*\{/g);
      const footerMatches = cssContent.match(/\.filterSheetFooter\s*\{/g);
      expect(bodyMatches?.length).toBe(1);
      expect(footerMatches?.length).toBe(1);
    });

    it("verifies plpFilterSidebar has overflow visible and no max-height constraint", () => {
      expect(cssContent).toMatch(
        /\.plpFilterSidebar\s*\{[^}]*overflow:\s*visible;[^}]*max-height:\s*none;/,
      );
    });

    it("verifies PDP bottom breathing room and mobile purchase dock clearance", () => {
      expect(cssContent).toContain(".pdpExperience");
      expect(cssContent).toMatch(
        /\.pdpRelatedSection:last-of-type\s*\{[^}]*padding-bottom:\s*clamp\(/,
      );
      expect(cssContent).toMatch(
        /\.pdpExperience\s*\{[^}]*padding-bottom:\s*calc\(7\.5rem/,
      );
    });

    it("verifies product media remediation for Stand, Headphones, and Car Mats", () => {
      const stand = manifestJson.find(
        (e) => e.publicReference === "CMA-PROD-STAND-1-R2",
      );
      const headphones = manifestJson.find(
        (e) => e.publicReference === "CMA-PROD-HEADPHONES-1-R2",
      );
      const carmats = manifestJson.find(
        (e) => e.publicReference === "CMA-PROD-CARMATS-1-R2",
      );

      expect(stand).toBeDefined();
      expect(stand?.provider).toBe("unsplash");
      expect(stand?.assetUrl).toContain("unsplash.com");

      expect(headphones).toBeDefined();
      expect(headphones?.provider).toBe("unsplash");
      expect(headphones?.assetUrl).toContain("unsplash.com");

      expect(carmats).toBeDefined();
      expect(carmats?.provider).toBe("unsplash");
      expect(carmats?.assetUrl).toContain("unsplash.com");
    });
  });
});
