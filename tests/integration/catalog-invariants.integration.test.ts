import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation, catalogEvidence, catalogReadyPrimary } from "./catalog-canonical-support";
import { rebuildCatalogPublicationSnapshot } from "@/lib/services/catalog-publication.service";
import { createStoreOfferPriceVersion } from "@/lib/services/store-price.service";
async function financialCounts() { return Promise.all([prisma.payment.count(), prisma.marketplaceOrder.count(), prisma.ledgerJournal.count(), prisma.storeEarning.count()]); }
describeCatalogIntegration("canonical catalog publication invariants", () => {
  it("denies a public snapshot from a draft product without changing financial or publication state", async () => {
    const f = await catalogFoundation(); await createStoreOfferPriceVersion(f.store.id, f.user.id, { offerPublicReference: f.offer.publicReference, amount: "10.00", currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date().toISOString(), offerVersion: 1, operationId: randomUUID() });
    const before = await financialCounts();
    await expect(rebuildCatalogPublicationSnapshot(f.offer.id, f.user.id, true)).rejects.toThrow();
    expect(await prisma.catalogPublicationSnapshot.count({ where: { offerId: f.offer.id } })).toBe(0);
    expect(await financialCounts()).toEqual(before); expect(await prisma.storeCatalogOffer.findUnique({ where: { id: f.offer.id } })).toMatchObject({ publicationStatus: "DRAFT" });
  });
  it("builds a private preview from real decoded media and persists append-only snapshot/event evidence", async () => {
    const f = await catalogFoundation(); await catalogReadyPrimary(f);
    await createStoreOfferPriceVersion(f.store.id, f.user.id, { offerPublicReference: f.offer.publicReference, amount: "10.01", currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date().toISOString(), offerVersion: 1, operationId: randomUUID() });
    const before = await financialCounts(); const snapshot = await rebuildCatalogPublicationSnapshot(f.offer.id, f.user.id);
    expect(snapshot).toMatchObject({ status: "BLOCKED", snapshot: { price: { amount: "10.01" } } });
    expect(await catalogEvidence(snapshot.publicReference)).toMatchObject({ audit: [{ action: "PREVIEW_REBUILT" }], events: [{ eventType: "SNAPSHOT_REBUILT" }] });
    await expect(prisma.catalogPublicationSnapshot.update({ where: { id: snapshot.id }, data: { snapshot: { changed: true } } })).rejects.toThrow();
    expect(await prisma.catalogPublicationSnapshot.findUnique({ where: { id: snapshot.id } })).toEqual(snapshot);
    expect(await financialCounts()).toEqual(before);
  });
});

