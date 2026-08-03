import { expect, test } from "vitest";
import { storefrontPrivateCacheHeaders } from "@/lib/storefront/cache/storefront-cache-policy";
import { source } from "@/tests/storefront/storefront-test-helpers";
test("preview route requires authorization and stays private/noindex", () => { const preview = source("app/api/storefront/preview/[snapshotReference]/route.ts"); expect(preview).toContain("getCurrentUser"); expect(preview).toContain("robots: \"noindex\""); expect(storefrontPrivateCacheHeaders()["Cache-Control"]).toContain("no-store"); });
test("preview is read-only and supports owner or exact preview permission", () => { const preview = source("app/api/storefront/preview/[snapshotReference]/route.ts"); expect(preview).toContain("ownerUserId === user.id"); expect(preview).toContain("STOREFRONT_PREVIEW_READ"); expect(preview).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)/); });
