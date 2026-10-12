import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { createCatalogCategory } from "@/lib/services/catalog-category.service";
import { createProductTypeDefinition, transitionProductTypeDefinition } from "@/lib/services/product-type.service";
import { createStorePrivateCatalogProduct } from "@/lib/services/catalog-product.service";
import sharp from "sharp";
import { CatalogMediaIntakeService, PrismaCatalogMediaRepository } from "@/lib/services/catalog-media-intake.service";
import { DeterministicCatalogMediaStorageAdapter } from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";
import { attachStoreCatalogMedia } from "@/lib/services/catalog-media-attachment.service";

export async function assertCatalogDatabase() {
  requireDisposableStoreSettlementDatabase();
  expect(await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role`).toEqual([{ database: "kt_launch_test", role: "disposable" }]);
}

/** Synthetic structural inputs; subjects are created through real commands.
 * No paid or published state is fabricated. */
export async function catalogFoundation() {
  await assertCatalogDatabase(); const tag = randomUUID();
  const user = await prisma.user.create({ data: { email: `catalog-${tag}@example.test`, name: "Disposable catalog owner", role: "STORE", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { ownerUserId: user.id, slug: `catalog-${tag}`, name: "Disposable catalog store", status: "ACTIVE" } });
  const category = await createCatalogCategory({ actorUserId: user.id, name: "Synthetic category", slug: `category-${tag}`, status: "ACTIVE", displayOrder: 0, operationId: randomUUID() });
  let definition = await createProductTypeDefinition({ actorUserId: user.id, code: `type-${tag}`, name: "Synthetic product type", versionNumber: 1, schemaVersion: 1, attributeSchema: { attributes: [] }, variantSchema: {}, complianceSchema: { requirements: [] }, searchFacetSchema: {}, operationId: randomUUID() });
  definition = await transitionProductTypeDefinition(definition.id, "UNDER_REVIEW", { actorUserId: user.id, version: definition.version, operationId: randomUUID() });
  definition = await transitionProductTypeDefinition(definition.id, "APPROVED", { actorUserId: user.id, version: definition.version, operationId: randomUUID() });
  const input = { scope: "STORE_PRIVATE" as const, productTypeDefinitionId: definition.id, primaryCategoryId: category.id, title: `Synthetic product ${tag}`, description: "A synthetic catalog product solely for named disposable acceptance.", condition: "NEW" as const, attributeValues: {}, complianceValues: {}, operationId: randomUUID() };
  const product = await createStorePrivateCatalogProduct(store.id, user.id, input);
  const offer = await prisma.storeCatalogOffer.create({ data: { publicReference: `offer-${tag}`, storeId: store.id, productId: product.id, variantId: product.variants[0].id, storeSku: tag, inventoryTrackingMode: "TRACKED", createdByUserId: user.id } });
  const location = await prisma.inventoryLocation.create({ data: { publicReference: `location-${tag}`, storeId: store.id, name: "Synthetic location" } });
  const inventory = await prisma.catalogInventoryItem.create({ data: { publicReference: `inventory-${tag}`, offerId: offer.id, variantId: product.variants[0].id, trackingMode: "TRACKED" } });
  return { tag, user, store, category, definition, input, product, offer, location, inventory };
}

export async function catalogEvidence(reference: string) {
  return { audit: await prisma.catalogAuditHistory.findMany({ where: { aggregateReference: reference }, orderBy: { createdAt: "asc" } }), events: await prisma.catalogChangeEvent.findMany({ where: { aggregateReference: reference }, orderBy: { createdAt: "asc" } }), receipts: await prisma.catalogOperationReceipt.findMany({ where: { aggregateReference: reference } }) };
}

export async function catalogReadyPrimary(f: Awaited<ReturnType<typeof catalogFoundation>>) {
  const bytes = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#008844" } }).png().toBuffer();
  const service = new CatalogMediaIntakeService(new PrismaCatalogMediaRepository(), new DeterministicCatalogMediaStorageAdapter());
  const intent = await service.createUploadIntent({ actorUserId: f.user.id, ownerType: "STORE", storeId: f.store.id, purpose: "PRODUCT_IMAGE", declaredMimeType: "image/png", declaredByteSize: bytes.length, operationId: randomUUID() });
  const command = { actorUserId: f.user.id, storeId: f.store.id, uploadReference: intent.upload.publicReference };
  await service.receiveUploadBytes({ ...command, operationId: randomUUID(), bytes });
  const ready = await service.completeUpload({ ...command, operationId: randomUUID() });
  const product = await prisma.catalogProduct.findUniqueOrThrow({ where: { id: f.product.id } });
  await attachStoreCatalogMedia(f.store.id, product.publicReference, f.user.id, { assetPublicReference: ready.asset.publicReference, role: "PRIMARY", altText: "Synthetic green product image", displayOrder: 0, productVersion: product.version, operationId: randomUUID() });
  return prisma.catalogProduct.findUniqueOrThrow({ where: { id: product.id } });
}
