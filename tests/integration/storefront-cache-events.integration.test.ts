import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { STOREFRONT_CACHE_TAGS } from "@/lib/storefront/cache/storefront-cache-policy";
import { createStorefrontFixture } from "./storefront-fixtures";

describe("storefront durable cache invalidation", () => {
  it("records product/store/category intents once per publication and replays them as pending", async () => {
    const f = await createStorefrontFixture();
    await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    const where = { sourceReference: f.source.offer.publicReference, sourceVersion: f.snapshot.publicationVersion };
    const rows = await prisma.storefrontCacheInvalidation.findMany({ where });
    expect(rows).toHaveLength(5);
    expect(rows.map(r => r.tag)).toEqual(expect.arrayContaining([STOREFRONT_CACHE_TAGS.product(f.source.product.publicReference), STOREFRONT_CACHE_TAGS.store(f.store.slug), STOREFRONT_CACHE_TAGS.category(f.source.category.publicReference)]));
    await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    expect(await prisma.storefrontCacheInvalidation.count({ where })).toBe(5);
    expect((await prisma.storefrontCacheInvalidation.findMany({ where })).every(r => r.status === "PENDING")).toBe(true);
  });
});
