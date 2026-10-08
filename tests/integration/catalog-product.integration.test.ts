import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getStoreCatalogProduct, updateStoreCatalogProduct, createStorePrivateCatalogProduct } from "@/lib/services/catalog-product.service";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation, catalogEvidence } from "./catalog-canonical-support";

describeCatalogIntegration("canonical catalog product persistence", () => {
  it("creates a private draft, default variant and atomic event/operation authority", async () => {
    const f = await catalogFoundation();
    expect(await getStoreCatalogProduct(f.store.id, f.product.publicReference)).toMatchObject({ status: "DRAFT", publicationStatus: "DRAFT", sourceStoreId: f.store.id, variants: [{ optionFingerprint: expect.any(String) }] });
    expect(await catalogEvidence(f.product.publicReference)).toMatchObject({ audit: [{ action: "DRAFT_CREATED" }], events: [{ eventType: "PRODUCT_UPDATED" }], receipts: [{ operationId: f.input.operationId }] });
    await expect(getStoreCatalogProduct("foreign-store", f.product.publicReference)).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
  });
  it("replays updates once and denies foreign, stale and changed commands", async () => {
    const f = await catalogFoundation(); const command = { version: f.product.version, title: "Updated synthetic title", operationId: randomUUID() };
    const updated = await updateStoreCatalogProduct(f.store.id, f.product.publicReference, f.user.id, command);
    expect(await updateStoreCatalogProduct(f.store.id, f.product.publicReference, f.user.id, command)).toEqual(updated);
    const evidence = await catalogEvidence(f.product.publicReference);
    await expect(updateStoreCatalogProduct("foreign-store", f.product.publicReference, f.user.id, { ...command, operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    await expect(updateStoreCatalogProduct(f.store.id, f.product.publicReference, f.user.id, { ...command, title: "Changed" })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    await expect(updateStoreCatalogProduct(f.store.id, f.product.publicReference, f.user.id, { ...command, operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
    expect(await catalogEvidence(f.product.publicReference)).toEqual(evidence);
  });
  it("rolls back a failed receipt together with the draft and its events", async () => {
    const f = await catalogFoundation();
    const before = { products: await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id } }), events: await prisma.catalogChangeEvent.count() };
    await expect(createStorePrivateCatalogProduct(f.store.id, f.user.id, { ...f.input, title: "Another synthetic product", slug: `other-${f.tag}` })).rejects.toThrow();
    expect(await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id } })).toBe(before.products);
    expect(await prisma.catalogChangeEvent.count()).toBe(before.events);
  });
});

