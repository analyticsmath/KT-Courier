import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import { StorefrontCollectionItemCreateSchema, StorefrontSynonymCreateSchema } from "@/lib/validation/storefront";
import { source } from "@/tests/storefront/storefront-test-helpers";

test("collection lifecycle endpoints exist with no generic status mutation", () => {
  for (const action of ["submit", "approve", "reject", "activate", "retire"]) expect(existsSync(`app/api/admin/storefront/collections/[publicReference]/${action}/route.ts`)).toBe(true);
  const handler = source("lib/storefront/storefront-admin-route-handlers.ts"); expect(handler).not.toContain("arbitraryStatus"); expect(handler).toContain("requireStorefrontAdminMutation");
});

test("collection targets are explicit and disallow offer/price/stock overrides", () => {
  expect(StorefrontCollectionItemCreateSchema.safeParse({ version: 1, targetType: "OFFER", targetReference: "CO-1", displayOrder: 0, operationId: "operation-1" }).success).toBe(false);
  expect(source("lib/services/storefront-collection.service.ts")).not.toMatch(/priceOverride|stockOverride|sponsor/i);
});

test("synonym lifecycle endpoints and strict deterministic body validation exist", () => {
  for (const action of ["submit", "approve", "reject", "activate", "retire"]) expect(existsSync(`app/api/admin/storefront/search-synonyms/[publicReference]/${action}/route.ts`)).toBe(true);
  expect(StorefrontSynonymCreateSchema.safeParse({ name: "tea", language: "en-ZA", terms: [{ input: "tea", outputs: ["rooibos"], direction: "EQUIVALENT", sql: "select 1" }], operationId: "operation-1" }).success).toBe(false);
});

test("projection reconciliation permits canonical rebuild only and no cache/data override", () => {
  const service = source("lib/services/storefront-reconciliation.service.ts"); expect(service).toContain("buildPublishedSnapshot"); expect(service).not.toMatch(/priceOverride|projectionJson|cacheDelete/i);
});

test("every storefront administration mutation shares auth, origin, rate, strict-body, and optimistic-version controls", () => {
  const guard = source("lib/storefront/storefront-admin-api.ts"); const validation = source("lib/validation/storefront.ts");
  expect(guard).toContain("requireAdminApiPermission"); expect(guard).toContain("enforceSameOriginRequest"); expect(guard).toContain("STOREFRONT_ADMIN_MUTATION"); expect(guard).toContain("readBoundedStorefrontJson"); expect(validation).toContain("const version");
});
