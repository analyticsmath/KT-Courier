import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import SponsoredCard from "@/components/advertising/SponsoredCard";

describe("Phase 24: Sponsored Disclosure Component Verification", () => {
  const defaultProps = {
    title: "Awesome Tea Brand",
    storeName: "Royal Tea Shop",
    priceAmount: "45.00",
    destinationUrl: "/shop/products/tea-123",
    imageUrl: "/images/tea.jpg"
  };

  const testCases = [
    { name: "search sponsored product", type: "PRODUCT", layout: "search", placement: "SEARCH_RESULTS" },
    { name: "category sponsored product", type: "PRODUCT", layout: "category", placement: "CATEGORY_BROWSE" },
    { name: "collection sponsored product", type: "PRODUCT", layout: "collection", placement: "COLLECTION_SURFACE" },
    { name: "related sponsored product", type: "PRODUCT", layout: "related", placement: "RELATED_PRODUCTS" },
    { name: "sponsored store discovery", type: "STORE", layout: "discovery", placement: "STORE_DISCOVERY_MAIN" },
    { name: "homepage sponsored-store rail", type: "STORE", layout: "rail", placement: "HOME_SPONSORED_RAIL" },
    { name: "desktop card", type: "PRODUCT", layout: "desktop", placement: "DESKTOP_GRID" },
    { name: "tablet card", type: "PRODUCT", layout: "tablet", placement: "TABLET_GRID" },
    { name: "compact mobile card", type: "PRODUCT", layout: "compact_mobile", placement: "MOBILE_COMPACT" }
  ] as const;

  for (const tc of testCases) {
    it(`renders ${tc.name} with compliant sponsored label and disclosure`, () => {
      // Use React.createElement to avoid JSX in .ts file
      const element = React.createElement(SponsoredCard, {
        sponsoredObjectType: tc.type,
        layout: tc.layout,
        placementCode: tc.placement,
        ...defaultProps
      });
      const html = renderToString(element);

      // 1. Every sponsored unit must expose: Sponsored
      expect(html).toContain("Sponsored");

      // 2. The disclosure must be visible without hover, present in compact layouts, not hidden inside a tooltip
      expect(html).toContain('role="status"');
      expect(html).not.toContain('style="display:none"');
      expect(html).not.toContain('style="display: none"');

      // 3. Accessible to screen readers
      expect(html).toContain("sr-only");
      expect(html).toContain("This is a paid sponsored advertisement.");
      expect(html).toContain(`aria-label="Sponsored ${tc.type === "PRODUCT" ? "product" : "store"}: ${defaultProps.title}"`);

      // 4. Carried in the canonical DTO contract
      expect(html).toContain(tc.placement);
    });
  }
});
