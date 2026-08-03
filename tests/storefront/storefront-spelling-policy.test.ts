import { expect, test } from "vitest";
import { findStorefrontCorrection } from "@/lib/storefront/search/storefront-ranking-policy";
import { document } from "@/tests/storefront/storefront-test-helpers";
test("typo correction is advisory and identifiers are exact", () => { expect(findStorefrontCorrection("dark chocolate barb", [document({ title: "Dark Chocolate Bar", normalizedTitle: "dark chocolate bar" })])).toBe("dark chocolate bar"); expect(findStorefrontCorrection("1234567890123", [document()])).toBeUndefined(); });
