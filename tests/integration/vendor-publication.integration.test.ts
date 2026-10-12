import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { createStoreInventoryLocation } from "@/lib/services/catalog-inventory-location.service";
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";
import { submitStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";
import { moderateCatalogProduct, moderateCatalogOffer } from "@/lib/services/catalog-moderation.service";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";
import { CatalogMediaIntakeService, PrismaCatalogMediaRepository } from "@/lib/services/catalog-media-intake.service";
import { DeterministicCatalogMediaStorageAdapter } from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";

async function foundation() {
  const tag = randomUUID();
  const owner = await prisma.user.create({ data: { email: `vendor-${tag}@example.test`, role: "STORE", status: "ACTIVE" } });
  const admin = await prisma.user.create({ data: { email: `publisher-${tag}@example.test`, role: "ADMIN", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { ownerUserId: owner.id, name: "Disposable five-product vendor", slug: `vendor-${tag}`, status: "ACTIVE" } });
  const location = await createStoreInventoryLocation(store.id, owner.id, { name: "Synthetic stockroom", operationId: randomUUID() });
  const categories = await Promise.all([0, 1].map(index => prisma.catalogCategory.create({ data: { publicReference: catalogPublicReference("CC"), name: `Synthetic category ${index}`, slug: `category-${index}-${tag}`, path: `/synthetic-${index}-${tag}`, depth: 0, status: "ACTIVE", createdByUserId: admin.id, updatedByUserId: admin.id } })));
  const definition = await prisma.productTypeDefinition.create({ data: { publicReference: catalogPublicReference("PT"), code: `TYPE_${tag.replaceAll("-", "").toUpperCase()}`, name: "Synthetic approved type", versionNumber: 1, status: "ACTIVE", attributeSchema: { attributes: [] }, variantSchema: {}, complianceSchema: { requirements: [] }, searchFacetSchema: {}, createdByUserId: admin.id } });
  return { tag, owner, admin, store, location, categories, definition };
}
async function listing(f: Awaited<ReturnType<typeof foundation>>, index = 0) {
  const intake = new CatalogMediaIntakeService(new PrismaCatalogMediaRepository(), new DeterministicCatalogMediaStorageAdapter());
  const media = [];
  for (const image of [0, 1]) {
    const bytes = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 30 + index * 30, g: 60 + image * 60, b: 90 } } }).png().toBuffer();
    const intent = await intake.createUploadIntent({ actorUserId: f.owner.id, ownerType: "STORE", storeId: f.store.id, purpose: "PRODUCT_IMAGE", declaredMimeType: "image/png", declaredByteSize: bytes.length, operationId: randomUUID() });
    const command = { actorUserId: f.owner.id, storeId: f.store.id, uploadReference: intent.upload.publicReference };
    await intake.receiveUploadBytes({ ...command, operationId: randomUUID(), bytes });
    const ready = await intake.completeUpload({ ...command, operationId: randomUUID() });
    expect(ready.asset.status).toBe("READY");
    media.push({ assetPublicReference: ready.asset.publicReference, altText: `Synthetic product ${index} image ${image}`, displayOrder: image, primary: image === 0, variantAssociation: "PRODUCT" as const });
  }
  const draft = await createStoreCatalogListingDraft(f.store.id, f.owner.id, { operationId: randomUUID(), product: { scope: "STORE_PRIVATE", productTypeDefinitionId: f.definition.id, primaryCategoryId: f.categories[index % 2].id, title: `Synthetic vendor product ${index} ${f.tag}`, description: "Disposable synthetic product for canonical publication acceptance.", condition: "NEW", attributeValues: {}, complianceValues: {} }, variants: [], modifiers: [], storeSku: `SYNTHETIC-${index}-${f.tag}`, price: { amount: `${20 + index}.25`, currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date().toISOString() }, openingStock: 7, inventoryLocationPublicReference: f.location.publicReference, media });
  const product = await submitStoreCatalogProduct(f.store.id, draft.publicReference, f.owner.id, { version: draft.version, operationId: randomUUID() });
  const approvedProduct = await moderateCatalogProduct(product.id, f.admin.id, "APPROVE", { version: product.version, operationId: randomUUID(), reasonCode: "SYNTHETIC_REVIEW" });
  const submitted = await transitionStoreCatalogOffer(f.store.id, draft.offers[0].publicReference, f.owner.id, "SUBMITTED", { version: draft.offers[0].version, operationId: randomUUID() });
  return { draft, approvedProduct, submitted };
}
async function approve(f: Awaited<ReturnType<typeof foundation>>, source: Awaited<ReturnType<typeof listing>>) {
  const offer = await moderateCatalogOffer(source.submitted.id, f.admin.id, "APPROVE", { version: source.submitted.version, operationId: randomUUID(), reasonCode: "SYNTHETIC_OFFER_REVIEW" });
  const command = { version: offer.version, productVersion: source.approvedProduct.version, priceVersionReference: source.draft.offers[0].priceVersions[0].publicReference, operationId: randomUUID(), reasonCode: "SYNTHETIC_PUBLICATION" };
  return { offer, command };
}

describe("new vendor publication through canonical commands", { timeout: 90_000 }, () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("publishes five independently created products with ten uploaded images, two categories and exact stock/prices", async () => {
    const f = await foundation();
    for (const index of [0, 1, 2, 3, 4]) {
      const source = await listing(f, index); const reviewed = await approve(f, source);
      const results = await Promise.all([publishApprovedCatalogListing(reviewed.offer.id, f.admin.id, reviewed.command), publishApprovedCatalogListing(reviewed.offer.id, f.admin.id, reviewed.command)]);
      expect(results.map(result => result.replayed).sort()).toEqual([false, true]);
      expect(results[0].snapshot).toEqual(results[1].snapshot); expect(results[0].offer).toEqual(results[1].offer);
      const doc = await prisma.storefrontProductDocument.findFirstOrThrow({ where: { offerId: reviewed.offer.id } });
      expect(doc).toMatchObject({ status: "ACTIVE", searchable: true, priceAmount: expect.anything() });
      expect(doc.priceAmount.toFixed(2)).toBe(`${20 + index}.25`);
      expect(doc.mediaGallery).toHaveLength(2);
      expect(await prisma.catalogPublicationSnapshot.count({ where: { offerId: reviewed.offer.id } })).toBe(1);
      await expect(publishApprovedCatalogListing(reviewed.offer.id, f.admin.id, { ...reviewed.command, reasonCode: "CHANGED_MEANING" })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    }
    expect(await prisma.catalogProduct.count({ where: { sourceStoreId: f.store.id, status: "ACTIVE", publicationStatus: "PUBLISHED" } })).toBe(5);
    expect(await prisma.catalogMediaAsset.count({ where: { ownerStoreId: f.store.id, status: "READY", privacyInspectionPassed: true } })).toBe(10);
    expect(await prisma.catalogInventoryLevel.findMany({ where: { locationId: (await prisma.inventoryLocation.findUniqueOrThrow({ where: { publicReference: f.location.publicReference } })).id }, select: { onHand: true, reserved: true, available: true } })).toEqual(Array.from({ length: 5 }, () => ({ onHand: 7, reserved: 0, available: 7 })));
    expect(await prisma.storefrontStoreDocument.findUniqueOrThrow({ where: { storeId: f.store.id } })).toMatchObject({ publicStatus: "ACTIVE", publishedOfferCount: 5 });
    expect(await prisma.storefrontCategoryDocument.count({ where: { categoryId: { in: f.categories.map(category => category.id) }, productCount: { gt: 0 } } })).toBe(2);
  });
  it("refuses unreviewed offers, stale facts and vendor publication without activating anything", async () => {
    const f = await foundation(); const source = await listing(f); const raw = { version: source.submitted.version, productVersion: source.approvedProduct.version, priceVersionReference: source.draft.offers[0].priceVersions[0].publicReference, operationId: randomUUID(), reasonCode: "SYNTHETIC_UNREVIEWED" };
    await expect(publishApprovedCatalogListing(source.submitted.id, f.admin.id, raw)).rejects.toMatchObject({ code: "CATALOG_PUBLICATION_NOT_REVIEWED" });
    await expect(publishApprovedCatalogListing(source.submitted.id, f.owner.id, raw)).rejects.toMatchObject({ code: "CATALOG_PUBLICATION_DENIED" });
    const reviewed = await approve(f, source);
    await expect(publishApprovedCatalogListing(reviewed.offer.id, f.admin.id, { ...reviewed.command, productVersion: 1 })).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
    await expect(publishApprovedCatalogListing(reviewed.offer.id, f.admin.id, { ...reviewed.command, priceVersionReference: "FOREIGN_PRICE" })).rejects.toMatchObject({ code: "CATALOG_PUBLICATION_PRICE_INVALID" });
    await prisma.user.update({ where: { id: f.owner.id }, data: { role: "ADMIN" } });
    await expect(publishApprovedCatalogListing(reviewed.offer.id, f.owner.id, reviewed.command)).rejects.toMatchObject({ code: "CATALOG_PUBLICATION_SELF_REVIEW" });
    expect(await prisma.catalogPublicationSnapshot.count({ where: { offerId: source.submitted.id } })).toBe(0);
    expect(await prisma.storefrontProductDocument.count({ where: { storeId: f.store.id } })).toBe(0);
    expect((await prisma.storeOfferPriceVersion.findFirstOrThrow({ where: { offerId: source.submitted.id } })).status).toBe("DRAFT");
  });
  it("replays concurrent offer submission without duplicate review cases and rejects changed operation facts", async () => {
    const f = await foundation(); const source = await listing(f);
    const command = { version: source.submitted.version, operationId: randomUUID() };
    const paused = await moderateCatalogOffer(source.submitted.id, f.admin.id, "REQUEST_CHANGES", { ...command, reasonCode: "SYNTHETIC_CHANGES" });
    const submit = { version: paused.version, operationId: randomUUID() };
    const results = await Promise.all([transitionStoreCatalogOffer(f.store.id, paused.publicReference, f.owner.id, "SUBMITTED", submit), transitionStoreCatalogOffer(f.store.id, paused.publicReference, f.owner.id, "SUBMITTED", submit)]);
    expect(results[0]).toEqual(results[1]);
    expect(await prisma.catalogModerationCase.count({ where: { offerId: paused.id } })).toBe(2);
    await expect(transitionStoreCatalogOffer(f.store.id, paused.publicReference, f.owner.id, "SUBMITTED", { ...submit, version: 1 })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
  });
  it("rolls back all publication state when the storefront projection cannot commit", async () => {
    const f = await foundation(); const source = await listing(f); const reviewed = await approve(f, source);
    const name = `closure_publication_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."storeId" = '${f.store.id}' THEN RAISE EXCEPTION 'DISPOSABLE_PUBLICATION_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON "StorefrontProductDocument" FOR EACH ROW EXECUTE FUNCTION "${name}"()`);
      await expect(publishApprovedCatalogListing(reviewed.offer.id, f.admin.id, reviewed.command)).rejects.toThrow("DISPOSABLE_PUBLICATION_FAILURE");
      expect(await prisma.catalogProduct.findUniqueOrThrow({ where: { id: source.approvedProduct.id } })).toMatchObject({ status: "APPROVED", publicationStatus: "DRAFT", version: source.approvedProduct.version });
      expect(await prisma.storeCatalogOffer.findUniqueOrThrow({ where: { id: reviewed.offer.id } })).toMatchObject({ status: "SUBMITTED", publicationStatus: "DRAFT", version: reviewed.offer.version });
      expect((await prisma.storeOfferPriceVersion.findFirstOrThrow({ where: { offerId: reviewed.offer.id } })).status).toBe("DRAFT");
      expect(await prisma.catalogPublicationSnapshot.count({ where: { offerId: reviewed.offer.id } })).toBe(0);
      expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: f.admin.id, operationId: reviewed.command.operationId } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON "StorefrontProductDocument"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}"()`);
    }
    expect((await publishApprovedCatalogListing(reviewed.offer.id, f.admin.id, reviewed.command)).offer.status).toBe("ACTIVE");
  });
});
