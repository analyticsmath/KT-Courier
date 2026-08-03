import { expect, test } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("storefront sitemap is source-locked and excludes query pages", () => { const implementation = source("app/(public)/shop/sitemap.ts"); expect(implementation).toContain("storefrontPublicExposureAllowed"); expect(implementation).not.toContain("search?"); });
