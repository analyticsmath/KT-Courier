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
      expect(humanizeFulfilmentMode("COURIER_DELIVERY")).toBe("Courier delivery");
      expect(humanizeFulfilmentMode("STORE_PICKUP")).toBe("Store pickup");
      expect(humanizeFulfilmentMode("PICKUP_AND_DELIVERY")).toBe("Pickup & delivery");
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
      expect(humanizeAttributeName("organic_certified")).toBe("Organic Certified");
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
    it("resolves the 5 Featured Marketplace Worlds to verified umbrella WebP assets", () => {
      const grocerySrc = storefrontCategoryMediaSrc("CMA-CAT-GROCERIES");
      expect(grocerySrc).toBeDefined();
      expect(grocerySrc).toBe("/media/public/derived/photo-grocery-market-counter-produce-1440w.webp");

      const fashionSrc = storefrontCategoryMediaSrc("CMA-CAT-FASHION");
      expect(fashionSrc).toBeDefined();
      expect(fashionSrc).toBe("/media/public/derived/photo-fashion-jhb-editorial-coat-1440w.webp");

      const diningSrc = storefrontCategoryMediaSrc("CMA-CAT-FOOD-DINING");
      expect(diningSrc).toBeDefined();
      expect(diningSrc).toBe("/media/public/derived/photo-food-prepared-grain-bowl-1440w.webp");

      const homeSrc = storefrontCategoryMediaSrc("CMA-CAT-HOME-LIVING");
      expect(homeSrc).toBeDefined();
      expect(homeSrc).toBe("/media/public/derived/commerce-homeware-natalia-blauth-43i1AK0McxM-unsplash-1440w.webp");

      const pharmacySrc = storefrontCategoryMediaSrc("CMA-CAT-PHARMACY");
      expect(pharmacySrc).toBeDefined();
      expect(pharmacySrc).toBe("/media/public/derived/photo-wellness-licensed-pharmacy-counter-1440w.webp");
    });

    it("resolves subcategories to curated umbrella photography", () => {
      const accessoriesSrc = storefrontCategoryMediaSrc("CMA-CAT-ACCESSORIES");
      expect(accessoriesSrc).toBe("/media/public/derived/photo-fashion-rosebank-leather-bags-1440w.webp");

      const footwearSrc = storefrontCategoryMediaSrc("CMA-CAT-FOOTWEAR");
      expect(footwearSrc).toBe("/media/public/derived/photo-fashion-designer-footwear-leather-1440w.webp");

      const decorSrc = storefrontCategoryMediaSrc("CMA-CAT-DECOR");
      expect(decorSrc).toBe("/media/public/derived/photo-commerce-cape-town-market-ceramics-1440w.webp");

      const personalCareSrc = storefrontCategoryMediaSrc("CMA-CAT-PERSONAL-CARE");
      expect(personalCareSrc).toBe("/media/public/derived/photo-wellness-organic-botanical-serum-1440w.webp");
    });
  });

  describe("CSS & Typography Invariants", () => {
    const root = process.cwd();
    const cssContent = readFileSync(
      join(root, "components/public-v2/commerce/commerce.module.css"),
      "utf8"
    );

    it("enforces line-clamp 3, line-height 1.34, and min-height 0 for productTileTitle", () => {
      expect(cssContent).toContain("-webkit-line-clamp: 3");
      expect(cssContent).toContain("line-height: 1.34");
      expect(cssContent).toContain("min-height: 0");
    });

    it("strictly forbids hover underline in commerce CSS", () => {
      // Must not have text-decoration: underline or :hover { text-decoration: underline }
      expect(cssContent).not.toMatch(/:hover[^{]*\{[^}]*text-decoration:\s*underline/);
      expect(cssContent).not.toMatch(/text-decoration:\s*underline/);
    });
  });
});
