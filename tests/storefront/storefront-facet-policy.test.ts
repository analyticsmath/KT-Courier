import { expect, test } from "vitest";
import { parseStorefrontFilters } from "@/lib/storefront/search/storefront-filter-url";
test("facets are bounded to reviewed-shaped codes and values", () => { const parsed = parseStorefrontFilters(new URLSearchParams("f.size=large,large,small&f.<script>=x")); expect(parsed.facets).toEqual({ size: ["large", "small"] }); });
