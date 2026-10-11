import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation } from "./catalog-canonical-support";
import { createStoreOfferPriceVersion, activateStoreOfferPriceVersion } from "@/lib/services/store-price.service";
describeCatalogIntegration("canonical catalog prices", () => {
  it("persists exact cents, denies foreign/stale writes and preserves immutable active price facts", async () => {
    const f = await catalogFoundation(); const command = { offerPublicReference: f.offer.publicReference, amount: "0.01", currency: "ZAR" as const, priceIncludesTax: true as const, effectiveFrom: new Date().toISOString(), offerVersion: f.offer.version, operationId: randomUUID() };
    const price = await createStoreOfferPriceVersion(f.store.id, f.user.id, command); expect(price.amount.toFixed(2)).toBe("0.01"); expect(price.status).toBe("DRAFT");
    await expect(createStoreOfferPriceVersion("foreign-store", f.user.id, { ...command, operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    await expect(createStoreOfferPriceVersion(f.store.id, f.user.id, { ...command, operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
    const active = await activateStoreOfferPriceVersion(price.id, f.user.id);
    expect(await prisma.storeCatalogOffer.findUnique({ where: { id: f.offer.id } })).toMatchObject({ currentPriceVersionId: price.id });
    await expect(prisma.storeOfferPriceVersion.update({ where: { id: price.id }, data: { amount: "0.02" } })).rejects.toThrow();
    expect(await prisma.storeOfferPriceVersion.findUnique({ where: { id: price.id } })).toEqual(active);
  });
  it("rejects overlapping active periods and duplicate store SKU without a new price or offer", async () => {
    const f = await catalogFoundation(); const from = new Date().toISOString();
    const price = await createStoreOfferPriceVersion(f.store.id, f.user.id, { offerPublicReference: f.offer.publicReference, amount: "100.00", currency: "ZAR", priceIncludesTax: true, effectiveFrom: from, offerVersion: 1, operationId: randomUUID() });
    await activateStoreOfferPriceVersion(price.id, f.user.id);
    const offer = await prisma.storeCatalogOffer.findUniqueOrThrow({ where: { id: f.offer.id } });
    await expect(createStoreOfferPriceVersion(f.store.id, f.user.id, { offerPublicReference: offer.publicReference, amount: "100.01", currency: "ZAR", priceIncludesTax: true, effectiveFrom: from, offerVersion: offer.version, operationId: randomUUID() })).rejects.toThrow();
    await expect(prisma.storeCatalogOffer.create({ data: { ...{ publicReference: randomUUID(), storeId: f.store.id, productId: f.product.id, variantId: f.product.variants[0].id, storeSku: f.offer.storeSku, inventoryTrackingMode: "TRACKED" as const, createdByUserId: f.user.id } } })).rejects.toThrow();
    expect(await prisma.storeOfferPriceVersion.count({ where: { offerId: f.offer.id } })).toBe(1);
  });
});

