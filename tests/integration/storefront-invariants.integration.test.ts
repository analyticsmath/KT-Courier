import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createStorefrontFixture } from "./storefront-fixtures";

describe("storefront publication evidence invariants", () => {
  it("blocks a snapshot containing private fields and records reconciliation without a public document", async () => {
    const f = await createStorefrontFixture({ privateSnapshot: true });
    await expect(prisma.catalogPublicationSnapshot.update({ where: { id: f.snapshot.id }, data: { snapshot: {} } })).rejects.toThrow();
    await expect(f.projections.buildPublishedSnapshot(f.snapshot.publicReference)).rejects.toMatchObject({ reason: "APPLICATION_FAILURE" });
    expect(await prisma.storefrontProductDocument.count({ where: { offerId: f.source.offer.id } })).toBe(0);
    expect(await prisma.storefrontProjectionCase.findFirst({ where: { aggregateReference: f.snapshot.publicReference } })).toMatchObject({ reason: "APPLICATION_FAILURE", status: "OPEN" });
  });
  it("blocks inactive store evidence even when its snapshot is published", async () => {
    const f = await createStorefrontFixture();
    await prisma.store.update({ where: { id: f.store.id }, data: { status: "SUSPENDED" } });
    await expect(f.projections.buildPublishedSnapshot(f.snapshot.publicReference)).rejects.toMatchObject({ reason: "OFFER_NOT_ELIGIBLE" });
    expect(await prisma.storefrontProductDocument.count({ where: { offerId: f.source.offer.id } })).toBe(0);
  });
});
