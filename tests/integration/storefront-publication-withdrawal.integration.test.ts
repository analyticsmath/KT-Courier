import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { StorefrontEventConsumerService } from "@/lib/services/storefront-event-consumer.service";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { createStorefrontFixture } from "./storefront-fixtures";
import { randomUUID } from "node:crypto";
import { transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";

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
  it("pauses and resumes the approved projection with replay-safe owner commands", async () => {
    const f = await createStorefrontFixture();
    await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    const actor = f.store.ownerUserId!;
    const current = await prisma.storeCatalogOffer.findUniqueOrThrow({ where: { id: f.source.offer.id } });
    const paused = await transitionStoreCatalogOffer(f.store.id, current.publicReference, actor, "PAUSED", { version: current.version, operationId: randomUUID() });
    expect(await prisma.storefrontProductDocument.findUnique({ where: { publicationSnapshotId: f.snapshot.id } })).toMatchObject({ status: "WITHDRAWN", searchable: false });
    expect(await prisma.storefrontCacheInvalidation.count({ where: { sourceReference: current.publicReference, sourceVersion: { startsWith: "withdrawn:" } } })).toBeGreaterThan(0);
    const command = { version: paused.version, operationId: randomUUID() };
    const resumed = await transitionStoreCatalogOffer(f.store.id, current.publicReference, actor, "ACTIVE", command);
    expect(resumed).toMatchObject({ status: "ACTIVE", publicationStatus: current.publicationStatus });
    expect(await prisma.storefrontProductDocument.findUnique({ where: { publicationSnapshotId: f.snapshot.id } })).toMatchObject({ status: "ACTIVE", searchable: true });
    expect((await transitionStoreCatalogOffer(f.store.id, current.publicReference, actor, "ACTIVE", command)).version).toBe(resumed.version);
    expect(await prisma.catalogPublicationSnapshot.count({ where: { offerId: current.id } })).toBe(1);
  });
  it("rolls back resume when the existing publication no longer passes eligibility", async () => {
    const f = await createStorefrontFixture();
    await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    const current = await prisma.storeCatalogOffer.findUniqueOrThrow({ where: { id: f.source.offer.id } });
    const paused = await transitionStoreCatalogOffer(f.store.id, current.publicReference, f.store.ownerUserId!, "PAUSED", { version: current.version, operationId: randomUUID() });
    await prisma.catalogProduct.update({ where: { id: f.source.product.id }, data: { status: "SUSPENDED" } });
    await expect(transitionStoreCatalogOffer(f.store.id, current.publicReference, f.store.ownerUserId!, "ACTIVE", { version: paused.version, operationId: randomUUID() })).rejects.toThrow();
    expect(await prisma.storeCatalogOffer.findUnique({ where: { id: current.id } })).toMatchObject({ status: "PAUSED", version: paused.version });
    expect(await prisma.storefrontProductDocument.findUnique({ where: { publicationSnapshotId: f.snapshot.id } })).toMatchObject({ status: "WITHDRAWN", searchable: false });
  });
});
