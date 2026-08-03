import { expect, test } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("store projection requires an active store and active projected offers", () => { const implementation = source("lib/services/storefront-store.service.ts"); expect(implementation).toContain('store.status === "ACTIVE"'); expect(implementation).not.toContain("address:"); expect(implementation).not.toContain("phone:"); });
