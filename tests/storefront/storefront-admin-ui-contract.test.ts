import { expect, test } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("admin controls use exact permission checks and offer no public override", () => { const handlers = source("lib/storefront/storefront-admin-route-handlers.ts"); expect(handlers).toContain("STOREFRONT_COLLECTIONS_MANAGE"); expect(handlers).toContain("STOREFRONT_PROJECTIONS_RECONCILE"); expect(handlers).not.toMatch(/priceOverride|publicationOverride|cacheDelete/i); });
