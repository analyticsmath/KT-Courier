import { expect, test } from "vitest";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import { STOREFRONT_PRODUCTION_VALIDATION_APPROVED, storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("production exposure remains source-locked", () => {
  expect(STOREFRONT_PRODUCTION_VALIDATION_APPROVED).toBe(false);
  expect(storefrontPublicExposureAllowed()).toBe(false);
  expect(publicStorefrontPageExposureAllowed()).toBe(false);
});

test("the public route segment and dynamic metadata fail closed before projection reads", () => {
  const layout = source("app/(public)/shop/layout.tsx");
  for (const page of [
    "categories/[...categoryPath]/page.tsx",
    "collections/[collectionSlug]/page.tsx",
    "products/[product]/page.tsx",
    "products/[product]/[variantReference]/page.tsx",
    "stores/[storeSlug]/page.tsx",
  ]) {
    expect(source(`app/(public)/shop/${page}`)).toContain("publicStorefrontPageExposureAllowed");
  }
  expect(layout).toContain('routeContext="storefront"');
});

test("isLocalStorefrontValidationAllowed enforces flag, safe DB URL, and non-production environment", async () => {
  const { isLocalStorefrontValidationAllowed } = await import("@/lib/testing/safe-postgres-validator");

  // 1. Without flag -> false
  expect(isLocalStorefrontValidationAllowed({ NODE_ENV: "development" })).toBe(false);

  // 2. With flag and safe local DB -> true
  expect(
    isLocalStorefrontValidationAllowed({
      KT_LOCAL_STOREFRONT_VALIDATION: "true",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/kt_phase2_disposable_test",
      NODE_ENV: "development",
    })
  ).toBe(true);

  // 3. With flag and unsafe remote DB -> false
  expect(
    isLocalStorefrontValidationAllowed({
      KT_LOCAL_STOREFRONT_VALIDATION: "true",
      DATABASE_URL: "postgresql://user:secret@my-db.rds.amazonaws.com:5432/kt_phase2_disposable_test",
      NODE_ENV: "development",
    })
  ).toBe(false);

  // 4. NODE_ENV=production always denies local activation
  expect(
    isLocalStorefrontValidationAllowed({
      KT_LOCAL_STOREFRONT_VALIDATION: "true",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/kt_phase2_disposable_test",
      NODE_ENV: "production",
    })
  ).toBe(false);

  // 5. Docker Compose service hostname (db) is accepted for E2E container environments
  expect(
    isLocalStorefrontValidationAllowed({
      KT_LOCAL_STOREFRONT_VALIDATION: "true",
      DATABASE_URL: "postgresql://kt_phase75_e2e:pass@db:5432/kt_phase75_e2e",
      NODE_ENV: "test",
    })
  ).toBe(true);
});
