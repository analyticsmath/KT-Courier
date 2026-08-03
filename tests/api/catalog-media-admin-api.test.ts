import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const source = ["lib/catalog/media/catalog-media-route-handlers.ts", "lib/validation/catalog-media.ts", "app/api/admin/catalog/media/route.ts", "app/api/admin/catalog/media/[id]/route.ts", "app/api/admin/catalog/media/[id]/approve/route.ts", "app/api/admin/catalog/media/[id]/quarantine/route.ts", "app/api/admin/catalog/media/[id]/reject/route.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
it("uses exact moderation permissions reviewed mutations and no DELETE or storage credentials", () => { for (const token of ["CATALOG_MODERATION_READ", "CATALOG_MODERATION_APPROVE", "CATALOG_MODERATION_SUSPEND", "CATALOG_MODERATION_REVIEW", "prepareCatalogMutation", "operationId", "reasonCode"]) expect(source).toContain(token); expect(source).not.toMatch(/export async function DELETE|storageKey|credentials|uploadToken/); });
