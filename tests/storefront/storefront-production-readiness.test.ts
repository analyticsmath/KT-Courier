import { expect, test } from "vitest";
import { STOREFRONT_PRODUCTION_VALIDATION_APPROVED, storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
test("production exposure remains source-locked", () => { expect(STOREFRONT_PRODUCTION_VALIDATION_APPROVED).toBe(false); expect(storefrontPublicExposureAllowed()).toBe(false); });
