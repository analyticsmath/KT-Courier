import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createStorefrontFixture } from "./storefront-fixtures";

describe("canonical PostgreSQL storefront projection", () => {
  it("builds exact publication evidence and replays with stable public identity", async () => {
    const f = await createStorefrontFixture();
    const first = await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    const second = await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    expect(second.publicReference).toBe(first.publicReference);
    expect(second).toMatchObject({ offerReference: f.source.offer.publicReference, publicationVersion: f.snapshot.publicationVersion, price: { amount: "100.00", currency: "ZAR", includesTax: true }, availability: "IN_STOCK", primaryMedia: { publicReference: f.asset.publicReference } });
    expect(await prisma.storefrontProductDocument.count({ where: { offerId: f.source.offer.id } })).toBe(1);
    expect(await prisma.storefrontProjectionHistory.findMany({ where: { document: { offerId: f.source.offer.id } }, orderBy: { createdAt: "asc" } })).toEqual([expect.objectContaining({ action: "BUILT", projectionVersion: 1 }), expect.objectContaining({ action: "REPLAYED", projectionVersion: 2 })]);
  });
});
