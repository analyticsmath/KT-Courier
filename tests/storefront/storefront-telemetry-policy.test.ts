import { expect, test } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("telemetry service excludes raw search and precise location values", () => { const implementation = source("lib/services/storefront-telemetry.service.ts"); expect(implementation).not.toMatch(/queryText|latitude|longitude|address/i); expect(implementation).toContain("queryCategory"); });
