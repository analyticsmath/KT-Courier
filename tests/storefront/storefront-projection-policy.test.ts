import { expect, test } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("projection requires active offer/store evidence and withdraws replaced offers", () => { const implementation = source("lib/services/storefront-projection.service.ts"); expect(implementation).toContain('source.offer.status !== "ACTIVE"'); expect(implementation).toContain('status: "WITHDRAWN"'); expect(implementation).toContain("storefrontCacheInvalidation"); });
