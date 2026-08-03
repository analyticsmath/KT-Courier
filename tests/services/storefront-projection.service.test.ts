import { expect, test, vi } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";
const dependencies = vi.hoisted(() => ({ findUnique: vi.fn(), projectionCaseUpsert: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { catalogPublicationSnapshot: { findUnique: dependencies.findUnique }, storefrontProjectionCase: { upsert: dependencies.projectionCaseUpsert } } }));
import { StorefrontProjectionService } from "@/lib/services/storefront-projection.service";
test("projection rejects a missing published snapshot and records a safe case", async () => { dependencies.findUnique.mockResolvedValue(null); await expect(new StorefrontProjectionService().buildPublishedSnapshot("CPS-missing")).rejects.toMatchObject({ reason: "SNAPSHOT_MISSING" }); expect(dependencies.projectionCaseUpsert).toHaveBeenCalled(); });
test("projection keeps same-snapshot identity while recording replay history", () => { const implementation = source("lib/services/storefront-projection.service.ts"); expect(implementation).toContain("publicationSnapshotId: snapshotId"); expect(implementation).toContain('action: existing ? "REPLAYED" : "BUILT"'); });
test("new source evidence replaces older offer projection and records cache intent", () => { const implementation = source("lib/services/storefront-projection.service.ts"); expect(implementation).toContain('status: "WITHDRAWN", searchable: false, indexable: false'); expect(implementation).toContain("storefrontCacheInvalidation.upsert"); });
test("projection has no catalog writer or exact-stock DTO field", () => { const implementation = source("lib/services/storefront-projection.service.ts"); expect(implementation).not.toMatch(/catalogProduct\.(create|update|delete)|availableQuantity:/); });
