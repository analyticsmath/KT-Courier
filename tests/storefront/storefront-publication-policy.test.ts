import { expect, test } from "vitest";
import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("draft or unpublished catalog evidence cannot become public before validation approval", () => { expect(assertStorefrontPublicExposureAllowed).toThrow("consolidated validation"); expect(source("lib/services/storefront-projection.service.ts")).toContain('source.status !== "PUBLISHED"'); });
