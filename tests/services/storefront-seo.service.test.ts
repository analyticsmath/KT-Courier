import { expect, test } from "vitest";
import { storefrontRobotsForFilters } from "@/lib/storefront/seo/storefront-facet-crawl-policy";
import { storefrontProductCanonical } from "@/lib/storefront/seo/storefront-canonical-policy";
test("SEO policy keeps filtered and locked evidence non-indexable", () => { expect(storefrontRobotsForFilters({ q: "tea" }).index).toBe(false); expect(storefrontProductCanonical("Tea", "CP-1")).not.toContain("?"); });
test("SEO policy keeps preview and arbitrary facets noindex", () => { expect(storefrontRobotsForFilters({}, true).index).toBe(false); expect(storefrontRobotsForFilters({ facets: { colour: ["red"] } }).index).toBe(false); });
