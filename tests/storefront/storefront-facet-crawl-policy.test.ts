import { expect, test } from "vitest";
import { storefrontRobotsForFilters, STOREFRONT_QUERY_ROBOTS } from "@/lib/storefront/seo/storefront-facet-crawl-policy";
test("search and arbitrary facet pages are noindex", () => { expect(STOREFRONT_QUERY_ROBOTS.index).toBe(false); expect(storefrontRobotsForFilters({ facets: { size: ["large"] } }).index).toBe(false); });
