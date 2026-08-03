import { expect, test } from "vitest";
import { storefrontPrivateCacheHeaders, storefrontPublicCacheHeaders } from "@/lib/storefront/cache/storefront-cache-policy";
test("private preview and location responses are no-store", () => { expect(storefrontPrivateCacheHeaders()["Cache-Control"]).toContain("no-store"); expect(storefrontPublicCacheHeaders().Vary).toBe("Cookie"); });
