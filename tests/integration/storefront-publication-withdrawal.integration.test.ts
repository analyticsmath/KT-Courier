import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { StorefrontEventConsumerService } from "@/lib/services/storefront-event-consumer.service";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { createStorefrontFixture } from "./storefront-fixtures";

describe("canonical storefront withdrawal", () => {
  it("removes a published offer from discovery while retaining its historical projection", async () => {
    const f = await createStorefrontFixture();
    await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    const adapter = new PostgresStorefrontSearchAdapter();
    expect(await adapter.search({ storeSlug: f.store.slug })).toHaveLength(1);
    await new StorefrontEventConsumerService(f.projections).withdrawOffer(f.source.offer.publicReference);
    expect(await adapter.search({ storeSlug: f.store.slug })).toHaveLength(0);
    expect(await prisma.storefrontProductDocument.findUnique({ where: { publicationSnapshotId: f.snapshot.id } })).toMatchObject({ status: "WITHDRAWN", searchable: false, indexable: false });
    expect(await prisma.catalogPublicationSnapshot.count({ where: { id: f.snapshot.id } })).toBe(1);
  });
});
