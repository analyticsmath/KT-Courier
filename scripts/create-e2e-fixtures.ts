import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { AddressType, DeliveryType, DriverAvailability, DriverOnboardingStatus, DriverStatus, OrderSource, OrderStatus, PermissionEffect, StoreStatus, UserRole, UserStatus, VehicleType } from "@/types/db";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { reverseLedgerJournal } from "@/lib/services/ledger-reversal.service";

const prisma = new PrismaClient();

async function upsertStore(email: string, slug: string, name: string, passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { status: UserStatus.ACTIVE, role: UserRole.STORE },
    create: { email, name, role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), passwordHash },
  });
  const store = await prisma.store.upsert({
    where: { slug },
    update: { ownerUserId: user.id, status: StoreStatus.ACTIVE },
    create: { ownerUserId: user.id, name, slug, status: StoreStatus.ACTIVE, city: "Johannesburg", province: "Gauteng", country: "South Africa" },
  });
  const address = await prisma.address.upsert({
    where: { id: `${slug}-pickup-address` },
    update: {},
    create: { id: `${slug}-pickup-address`, storeId: store.id, type: AddressType.PICKUP, label: "E2E default pickup", line1: "10 E2E Pickup Road", city: "Johannesburg", province: "Gauteng", country: "South Africa", latitude: -26.2041, longitude: 28.0473, isDefault: true },
  });
  await prisma.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: address.id } });
  return { user, store };
}

export async function upsertDriver(email: string, code: string, regionId: string, passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { status: UserStatus.ACTIVE, role: UserRole.DRIVER },
    create: { email, name: code, role: UserRole.DRIVER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), passwordHash },
  });
  const profile = await prisma.driverProfile.upsert({
    where: { userId: user.id },
    update: { status: DriverStatus.ACTIVE, active: true, availability: DriverAvailability.AVAILABLE, maxConcurrentAssignments: 2 },
    create: { userId: user.id, driverCode: code, displayName: code, status: DriverStatus.ACTIVE, active: true, availability: DriverAvailability.AVAILABLE, onboardingStatus: DriverOnboardingStatus.APPROVED, vehicleType: VehicleType.CAR, maxConcurrentAssignments: 2 },
  });
  await prisma.driverServiceRegion.upsert({ where: { driverProfileId_deliveryRegionId: { driverProfileId: profile.id, deliveryRegionId: regionId } }, update: {}, create: { driverProfileId: profile.id, deliveryRegionId: regionId, isPrimary: true } });
  return { user, profile };
}

async function seedPhase2Fixtures(passwordHash: string) {
  const storeUser = await prisma.user.upsert({
    where: { email: "e2e-store@ktcouriers.local" },
    update: { status: UserStatus.ACTIVE, role: UserRole.STORE },
    create: { email: "e2e-store@ktcouriers.local", name: "E2E Store Owner", role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), passwordHash },
  });
  const store = await prisma.store.upsert({
    where: { slug: "e2e-store" },
    update: { ownerUserId: storeUser.id, status: StoreStatus.ACTIVE },
    create: { ownerUserId: storeUser.id, name: "E2E Store", slug: "e2e-store", status: StoreStatus.ACTIVE, city: "Johannesburg", province: "Gauteng", country: "South Africa" },
  });

  const otherStoreUser = await prisma.user.upsert({
    where: { email: "e2e-other-store@ktcouriers.local" },
    update: { status: UserStatus.ACTIVE, role: UserRole.STORE },
    create: { email: "e2e-other-store@ktcouriers.local", name: "E2E Other Store Owner", role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), passwordHash },
  });
  const otherStore = await prisma.store.upsert({
    where: { slug: "e2e-other-store" },
    update: { ownerUserId: otherStoreUser.id, status: StoreStatus.ACTIVE },
    create: { ownerUserId: otherStoreUser.id, name: "E2E Other Store", slug: "e2e-other-store", status: StoreStatus.ACTIVE, city: "Johannesburg", province: "Gauteng", country: "South Africa" },
  });

  // Category
  const category = await prisma.catalogCategory.upsert({
    where: { publicReference: "cat_electronics" },
    update: { name: "Electronics", path: "electronics", depth: 0, status: "ACTIVE" },
    create: { publicReference: "cat_electronics", name: "Electronics", slug: "electronics", path: "electronics", depth: 0, status: "ACTIVE", createdByUserId: storeUser.id, updatedByUserId: storeUser.id },
  });

  await prisma.storefrontCategoryDocument.upsert({
    where: { categoryId: category.id },
    update: { name: "Electronics", canonicalPath: "electronics", productCount: 3, childNavigation: [], availableFacetDefinitions: {}, sourceUpdatedAt: new Date(), indexedAt: new Date() },
    create: { categoryId: category.id, categoryPublicReference: "cat_electronics", canonicalPath: "electronics", name: "Electronics", description: "All electronics products", productCount: 3, childNavigation: [], availableFacetDefinitions: {}, sourceUpdatedAt: new Date(), indexedAt: new Date() },
  });

  // Product Type Definition
  const productType = await prisma.productTypeDefinition.upsert({
    where: { code_versionNumber: { code: "smartphone", versionNumber: 1 } },
    update: { name: "Smartphone", status: "ACTIVE" },
    create: { publicReference: "ptd_smartphone", code: "smartphone", name: "Smartphone", description: "Smartphones and mobile devices", versionNumber: 1, attributeSchema: {}, variantSchema: {}, complianceSchema: {}, searchFacetSchema: {}, status: "ACTIVE", createdByUserId: storeUser.id },
  });

  // Product 1: Smartphone
  const smartphone = await prisma.catalogProduct.upsert({
    where: { publicReference: "prod_e2esmartphone" },
    update: { title: "E2E Smartphone" },
    create: { publicReference: "prod_e2esmartphone", scope: "GLOBAL_CANONICAL", productTypeDefinitionId: productType.id, productTypeVersionNumber: 1, primaryCategoryId: category.id, title: "E2E Smartphone", normalizedTitle: "e2e smartphone", slug: "e2e-smartphone", attributeValues: {}, complianceValues: {}, qualityIssues: [], createdByUserId: storeUser.id, status: "DRAFT", moderationStatus: "APPROVED", publicationStatus: "PUBLISHED" },
  });

  const var64 = await prisma.catalogProductVariant.upsert({
    where: { publicReference: "var_64gb" },
    update: { title: "64GB / Black", status: "ACTIVE" },
    create: { publicReference: "var_64gb", productId: smartphone.id, title: "64GB / Black", normalizedTitle: "64gb black", optionFingerprint: "var_64gb", skuReference: "E2E-PHONE-64", attributeValues: {}, status: "ACTIVE" },
  });
  const var128 = await prisma.catalogProductVariant.upsert({
    where: { publicReference: "var_128gb" },
    update: { title: "128GB / Silver", status: "ACTIVE" },
    create: { publicReference: "var_128gb", productId: smartphone.id, title: "128GB / Silver", normalizedTitle: "128gb silver", optionFingerprint: "var_128gb", skuReference: "E2E-PHONE-128", attributeValues: {}, status: "ACTIVE" },
  });

  await prisma.catalogProduct.update({
    where: { id: smartphone.id },
    data: { status: "ACTIVE" },
  });

  // Offers for Product 1
  const offer64 = await prisma.storeCatalogOffer.upsert({
    where: { publicReference: "off_64gb" },
    update: {},
    create: { publicReference: "off_64gb", storeId: store.id, productId: smartphone.id, variantId: var64.id, storeSku: "OFF-PHONE-64", merchantTitle: "E2E Smartphone 64GB", status: "DRAFT", publicationStatus: "DRAFT", inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", createdByUserId: storeUser.id },
  });
  const offer128 = await prisma.storeCatalogOffer.upsert({
    where: { publicReference: "off_128gb" },
    update: {},
    create: { publicReference: "off_128gb", storeId: store.id, productId: smartphone.id, variantId: var128.id, storeSku: "OFF-PHONE-128", merchantTitle: "E2E Smartphone 128GB", status: "DRAFT", publicationStatus: "DRAFT", inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", createdByUserId: storeUser.id },
  });

  // Prices
  const price64 = await prisma.storeOfferPriceVersion.upsert({
    where: { publicReference: "prc_64gb" },
    update: { amount: "1500.00", status: "ACTIVE" },
    create: { publicReference: "prc_64gb", offerId: offer64.id, versionNumber: 1, amount: "1500.00", currency: "ZAR", effectiveFrom: new Date("2020-01-01"), status: "ACTIVE", createdByUserId: storeUser.id },
  });
  const price128 = await prisma.storeOfferPriceVersion.upsert({
    where: { publicReference: "prc_128gb" },
    update: { amount: "2000.00", status: "ACTIVE" },
    create: { publicReference: "prc_128gb", offerId: offer128.id, versionNumber: 1, amount: "2000.00", currency: "ZAR", effectiveFrom: new Date("2020-01-01"), status: "ACTIVE", createdByUserId: storeUser.id },
  });

  await prisma.storeCatalogOffer.update({ where: { id: offer64.id }, data: { currentPriceVersionId: price64.id, status: "ACTIVE", publicationStatus: "PUBLISHED" } });
  await prisma.storeCatalogOffer.update({ where: { id: offer128.id }, data: { currentPriceVersionId: price128.id, status: "ACTIVE", publicationStatus: "PUBLISHED" } });

  // Modifier Group
  const modGroup = await prisma.storeModifierGroup.upsert({
    where: { publicReference: "mod_warranty" },
    update: { name: "Extended Warranty" },
    create: { publicReference: "mod_warranty", storeId: store.id, name: "Extended Warranty", minimumSelections: 0, maximumSelections: 1, isRequired: false, status: "ACTIVE" },
  });
  await prisma.storeModifierOption.upsert({
    where: { publicReference: "opt_2yr" },
    update: { name: "2 Year Warranty", priceDelta: "250.00" },
    create: { publicReference: "opt_2yr", groupId: modGroup.id, name: "2 Year Warranty", priceDelta: "250.00", currency: "ZAR", status: "ACTIVE" },
  });
  await prisma.storeOfferModifierGroup.upsert({
    where: { offerId_groupId: { offerId: offer64.id, groupId: modGroup.id } },
    update: {},
    create: { offerId: offer64.id, groupId: modGroup.id, displayOrder: 1 },
  });

  // Inventory Location & Levels
  const invLoc = await prisma.inventoryLocation.upsert({
    where: { publicReference: "loc_e2e_primary" },
    update: {},
    create: { publicReference: "loc_e2e_primary", storeId: store.id, name: "Primary E2E Warehouse", isPrimary: true, status: "ACTIVE" },
  });
  const invItem64 = await prisma.catalogInventoryItem.upsert({
    where: { offerId: offer64.id },
    update: {},
    create: { publicReference: "inv_64gb", offerId: offer64.id, variantId: var64.id, trackingMode: "TRACKED" },
  });
  await prisma.catalogInventoryMovement.upsert({
    where: { publicReference: "mov_64gb" },
    update: {},
    create: { publicReference: "mov_64gb", inventoryItemId: invItem64.id, locationId: invLoc.id, type: "INITIAL_STOCK", quantityDelta: 50, operationId: "op_mov_64gb_12345", requestHash: "hash_mov_64gb_123456789", reasonCode: "INITIAL_STOCK", actorUserId: storeUser.id, resultingOnHand: 50 },
  });
  await prisma.catalogInventoryLevel.upsert({
    where: { inventoryItemId_locationId: { inventoryItemId: invItem64.id, locationId: invLoc.id } },
    update: { available: 50, onHand: 50 },
    create: { inventoryItemId: invItem64.id, locationId: invLoc.id, available: 50, reserved: 0, onHand: 50 },
  });

  const invItem128 = await prisma.catalogInventoryItem.upsert({
    where: { offerId: offer128.id },
    update: {},
    create: { publicReference: "inv_128gb", offerId: offer128.id, variantId: var128.id, trackingMode: "TRACKED" },
  });
  await prisma.catalogInventoryMovement.upsert({
    where: { publicReference: "mov_128gb" },
    update: {},
    create: { publicReference: "mov_128gb", inventoryItemId: invItem128.id, locationId: invLoc.id, type: "INITIAL_STOCK", quantityDelta: 50, operationId: "op_mov_128gb_12345", requestHash: "hash_mov_128gb_123456789", reasonCode: "INITIAL_STOCK", actorUserId: storeUser.id, resultingOnHand: 50 },
  });
  await prisma.catalogInventoryLevel.upsert({
    where: { inventoryItemId_locationId: { inventoryItemId: invItem128.id, locationId: invLoc.id } },
    update: { available: 50, onHand: 50 },
    create: { inventoryItemId: invItem128.id, locationId: invLoc.id, available: 50, reserved: 0, onHand: 50 },
  });

  const pubVer = "pub_version_1.0.0_e2e";

  // Publication Snapshots
  const snap64 = await prisma.catalogPublicationSnapshot.upsert({
    where: { offerId_publicationVersion: { offerId: offer64.id, publicationVersion: pubVer } },
    update: { status: "PUBLISHED" },
    create: { publicReference: "snap_64gb", productId: smartphone.id, variantId: var64.id, offerId: offer64.id, versionNumber: 1, publicationVersion: pubVer, snapshot: {}, status: "PUBLISHED", createdByUserId: storeUser.id },
  });
  const snap128 = await prisma.catalogPublicationSnapshot.upsert({
    where: { offerId_publicationVersion: { offerId: offer128.id, publicationVersion: pubVer } },
    update: { status: "PUBLISHED" },
    create: { publicReference: "snap_128gb", productId: smartphone.id, variantId: var128.id, offerId: offer128.id, versionNumber: 1, publicationVersion: pubVer, snapshot: {}, status: "PUBLISHED", createdByUserId: storeUser.id },
  });

  // Product 2: Product No Media
  const noMediaProduct = await prisma.catalogProduct.upsert({
    where: { publicReference: "prod_nomedia" },
    update: { title: "E2E Product No Media" },
    create: { publicReference: "prod_nomedia", scope: "GLOBAL_CANONICAL", productTypeDefinitionId: productType.id, productTypeVersionNumber: 1, primaryCategoryId: category.id, title: "E2E Product No Media", normalizedTitle: "e2e product no media", slug: "e2e-product-no-media", attributeValues: {}, complianceValues: {}, qualityIssues: [], createdByUserId: storeUser.id, status: "DRAFT", moderationStatus: "APPROVED", publicationStatus: "PUBLISHED" },
  });
  const varNoMedia = await prisma.catalogProductVariant.upsert({
    where: { publicReference: "var_nomedia" },
    update: { title: "Standard", status: "ACTIVE" },
    create: { publicReference: "var_nomedia", productId: noMediaProduct.id, title: "Standard", normalizedTitle: "standard", optionFingerprint: "var_nomedia", skuReference: "E2E-NOMEDIA-STD", attributeValues: {}, status: "ACTIVE" },
  });
  await prisma.catalogProduct.update({
    where: { id: noMediaProduct.id },
    data: { status: "ACTIVE" },
  });

  const offerNoMedia = await prisma.storeCatalogOffer.upsert({
    where: { publicReference: "off_nomedia" },
    update: {},
    create: { publicReference: "off_nomedia", storeId: store.id, productId: noMediaProduct.id, variantId: varNoMedia.id, storeSku: "OFF-NOMEDIA", merchantTitle: "E2E Product No Media", status: "DRAFT", publicationStatus: "DRAFT", inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", createdByUserId: storeUser.id },
  });
  const priceNoMedia = await prisma.storeOfferPriceVersion.upsert({
    where: { publicReference: "prc_nomedia" },
    update: { amount: "500.00", status: "ACTIVE" },
    create: { publicReference: "prc_nomedia", offerId: offerNoMedia.id, versionNumber: 1, amount: "500.00", currency: "ZAR", effectiveFrom: new Date("2020-01-01"), status: "ACTIVE", createdByUserId: storeUser.id },
  });
  await prisma.storeCatalogOffer.update({ where: { id: offerNoMedia.id }, data: { currentPriceVersionId: priceNoMedia.id, status: "ACTIVE", publicationStatus: "PUBLISHED" } });

  const snapNoMedia = await prisma.catalogPublicationSnapshot.upsert({
    where: { offerId_publicationVersion: { offerId: offerNoMedia.id, publicationVersion: pubVer } },
    update: { status: "PUBLISHED" },
    create: { publicReference: "snap_nomedia", productId: noMediaProduct.id, variantId: varNoMedia.id, offerId: offerNoMedia.id, versionNumber: 1, publicationVersion: pubVer, snapshot: {}, status: "PUBLISHED", createdByUserId: storeUser.id },
  });

  // Product 3: Headphones
  const headphones = await prisma.catalogProduct.upsert({
    where: { publicReference: "prod_headphones" },
    update: { title: "Wireless Headphones" },
    create: { publicReference: "prod_headphones", scope: "GLOBAL_CANONICAL", productTypeDefinitionId: productType.id, productTypeVersionNumber: 1, primaryCategoryId: category.id, title: "Wireless Headphones", normalizedTitle: "wireless headphones", slug: "wireless-headphones", attributeValues: {}, complianceValues: {}, qualityIssues: [], createdByUserId: storeUser.id, status: "DRAFT", moderationStatus: "APPROVED", publicationStatus: "PUBLISHED" },
  });
  const varHeadphones = await prisma.catalogProductVariant.upsert({
    where: { publicReference: "var_headphones" },
    update: { title: "Black", status: "ACTIVE" },
    create: { publicReference: "var_headphones", productId: headphones.id, title: "Black", normalizedTitle: "black", optionFingerprint: "var_headphones", skuReference: "E2E-AUDIO-BLK", attributeValues: {}, status: "ACTIVE" },
  });
  await prisma.catalogProduct.update({
    where: { id: headphones.id },
    data: { status: "ACTIVE" },
  });

  const offerHeadphones = await prisma.storeCatalogOffer.upsert({
    where: { publicReference: "off_headphones" },
    update: {},
    create: { publicReference: "off_headphones", storeId: store.id, productId: headphones.id, variantId: varHeadphones.id, storeSku: "OFF-HEADPHONES", merchantTitle: "Wireless Headphones", status: "DRAFT", publicationStatus: "DRAFT", inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", createdByUserId: storeUser.id },
  });
  const priceHeadphones = await prisma.storeOfferPriceVersion.upsert({
    where: { publicReference: "prc_headphones" },
    update: { amount: "800.00", status: "ACTIVE" },
    create: { publicReference: "prc_headphones", offerId: offerHeadphones.id, versionNumber: 1, amount: "800.00", currency: "ZAR", effectiveFrom: new Date("2020-01-01"), status: "ACTIVE", createdByUserId: storeUser.id },
  });
  await prisma.storeCatalogOffer.update({ where: { id: offerHeadphones.id }, data: { currentPriceVersionId: priceHeadphones.id, status: "ACTIVE", publicationStatus: "PUBLISHED" } });

  const snapHeadphones = await prisma.catalogPublicationSnapshot.upsert({
    where: { offerId_publicationVersion: { offerId: offerHeadphones.id, publicationVersion: pubVer } },
    update: { status: "PUBLISHED" },
    create: { publicReference: "snap_headphones", productId: headphones.id, variantId: varHeadphones.id, offerId: offerHeadphones.id, versionNumber: 1, publicationVersion: pubVer, snapshot: {}, status: "PUBLISHED", createdByUserId: storeUser.id },
  });

  // Storefront Store Documents
  await prisma.storefrontStoreDocument.upsert({
    where: { storeId: store.id },
    update: { name: "E2E Store", slug: "e2e-store", publicStatus: "ACTIVE", publishedOfferCount: 4 },
    create: { storeId: store.id, storePublicReference: "e2e-store-ref", slug: "e2e-store", name: "E2E Store", shortDescription: "Verified E2E Electronics Store", publicCategoryCodes: ["electronics"], fulfilmentModes: ["COURIER_DELIVERY"], serviceAreaReferences: ["PRIMARY"], publicStatus: "ACTIVE", publishedOfferCount: 4, sourceUpdatedAt: new Date(), indexedAt: new Date() },
  });
  await prisma.storefrontStoreDocument.upsert({
    where: { storeId: otherStore.id },
    update: { name: "E2E Other Store", slug: "e2e-other-store", publicStatus: "ACTIVE", publishedOfferCount: 0 },
    create: { storeId: otherStore.id, storePublicReference: "e2e-other-store-ref", slug: "e2e-other-store", name: "E2E Other Store", shortDescription: "Second E2E Store for ownership isolation tests", publicCategoryCodes: [], fulfilmentModes: ["COURIER_DELIVERY"], serviceAreaReferences: ["PRIMARY"], publicStatus: "ACTIVE", publishedOfferCount: 0, sourceUpdatedAt: new Date(), indexedAt: new Date() },
  });

  // Storefront Product Documents
  const sfDocs = [
    {
      publicReference: "sf_64gb",
      publicationSnapshotId: snap64.id,
      publicationVersion: pubVer,
      productId: smartphone.id,
      productPublicReference: "prod_e2esmartphone",
      productSlug: "e2e-smartphone",
      productScope: "GLOBAL_CANONICAL" as const,
      variantId: var64.id,
      variantPublicReference: "var_64gb",
      offerId: offer64.id,
      offerPublicReference: "off_64gb",
      storeId: store.id,
      storePublicReference: "e2e-store-ref",
      storeSlug: "e2e-store",
      categoryId: category.id,
      categoryPublicReference: "cat_electronics",
      categoryPath: "electronics",
      productTypeCode: "smartphone",
      productTypeVersion: 1,
      brandPublicReference: null,
      brandName: "E2E Tech",
      title: "E2E Smartphone 64GB",
      normalizedTitle: "e2e smartphone 64gb",
      shortDescription: "High-spec 64GB Smartphone",
      publicDescription: "High performance 64GB smartphone for E2E testing.",
      searchText: "E2E Smartphone 64GB electronics E2E Tech",
      searchableAttributes: {},
      filterableAttributes: {},
      variantOptions: { Storage: "64GB", Color: "Black" },
      condition: "NEW" as const,
      fulfilmentMode: "COURIER_DELIVERY" as const,
      sellingUnit: "EACH" as const,
      priceVersionId: price64.id,
      pricePublicReference: "prc_64gb",
      priceAmount: "1500.00",
      currency: "ZAR",
      priceIncludesTax: true,
      inventoryTrackingMode: "TRACKED" as const,
      availabilityState: "IN_STOCK" as const,
      primaryMediaPublicReference: null,
      searchable: true,
      indexable: true,
      status: "ACTIVE" as const,
      publishedAt: new Date(),
      sourceUpdatedAt: new Date(),
      indexedAt: new Date(),
    },
    {
      publicReference: "sf_128gb",
      publicationSnapshotId: snap128.id,
      publicationVersion: pubVer,
      productId: smartphone.id,
      productPublicReference: "prod_e2esmartphone",
      productSlug: "e2e-smartphone",
      productScope: "GLOBAL_CANONICAL" as const,
      variantId: var128.id,
      variantPublicReference: "var_128gb",
      offerId: offer128.id,
      offerPublicReference: "off_128gb",
      storeId: store.id,
      storePublicReference: "e2e-store-ref",
      storeSlug: "e2e-store",
      categoryId: category.id,
      categoryPublicReference: "cat_electronics",
      categoryPath: "electronics",
      productTypeCode: "smartphone",
      productTypeVersion: 1,
      brandPublicReference: null,
      brandName: "E2E Tech",
      title: "E2E Smartphone 128GB",
      normalizedTitle: "e2e smartphone 128gb",
      shortDescription: "High-spec 128GB Smartphone",
      publicDescription: "High performance 128GB smartphone for E2E testing.",
      searchText: "E2E Smartphone 128GB electronics E2E Tech",
      searchableAttributes: {},
      filterableAttributes: {},
      variantOptions: { Storage: "128GB", Color: "Silver" },
      condition: "NEW" as const,
      fulfilmentMode: "COURIER_DELIVERY" as const,
      sellingUnit: "EACH" as const,
      priceVersionId: price128.id,
      pricePublicReference: "prc_128gb",
      priceAmount: "2000.00",
      currency: "ZAR",
      priceIncludesTax: true,
      inventoryTrackingMode: "TRACKED" as const,
      availabilityState: "IN_STOCK" as const,
      primaryMediaPublicReference: null,
      searchable: true,
      indexable: true,
      status: "ACTIVE" as const,
      publishedAt: new Date(),
      sourceUpdatedAt: new Date(),
      indexedAt: new Date(),
    },
    {
      publicReference: "sf_nomedia",
      publicationSnapshotId: snapNoMedia.id,
      publicationVersion: pubVer,
      productId: noMediaProduct.id,
      productPublicReference: "prod_nomedia",
      productSlug: "e2e-product-no-media",
      productScope: "GLOBAL_CANONICAL" as const,
      variantId: varNoMedia.id,
      variantPublicReference: "var_nomedia",
      offerId: offerNoMedia.id,
      offerPublicReference: "off_nomedia",
      storeId: store.id,
      storePublicReference: "e2e-store-ref",
      storeSlug: "e2e-store",
      categoryId: category.id,
      categoryPublicReference: "cat_electronics",
      categoryPath: "electronics",
      productTypeCode: "smartphone",
      productTypeVersion: 1,
      brandPublicReference: null,
      brandName: "E2E Tech",
      title: "E2E Product No Media",
      normalizedTitle: "e2e product no media",
      shortDescription: "Product without primary media",
      publicDescription: "Test product with no media attached.",
      searchText: "E2E Product No Media electronics",
      searchableAttributes: {},
      filterableAttributes: {},
      variantOptions: {},
      condition: "NEW" as const,
      fulfilmentMode: "COURIER_DELIVERY" as const,
      sellingUnit: "EACH" as const,
      priceVersionId: priceNoMedia.id,
      pricePublicReference: "prc_nomedia",
      priceAmount: "500.00",
      currency: "ZAR",
      priceIncludesTax: true,
      inventoryTrackingMode: "TRACKED" as const,
      availabilityState: "IN_STOCK" as const,
      primaryMediaPublicReference: null,
      searchable: true,
      indexable: true,
      status: "ACTIVE" as const,
      publishedAt: new Date(),
      sourceUpdatedAt: new Date(),
      indexedAt: new Date(),
    },
    {
      publicReference: "sf_headphones",
      publicationSnapshotId: snapHeadphones.id,
      publicationVersion: pubVer,
      productId: headphones.id,
      productPublicReference: "prod_headphones",
      productSlug: "wireless-headphones",
      productScope: "GLOBAL_CANONICAL" as const,
      variantId: varHeadphones.id,
      variantPublicReference: "var_headphones",
      offerId: offerHeadphones.id,
      offerPublicReference: "off_headphones",
      storeId: store.id,
      storePublicReference: "e2e-store-ref",
      storeSlug: "e2e-store",
      categoryId: category.id,
      categoryPublicReference: "cat_electronics",
      categoryPath: "electronics",
      productTypeCode: "smartphone",
      productTypeVersion: 1,
      brandPublicReference: null,
      brandName: "E2E Audio",
      title: "Wireless Headphones",
      normalizedTitle: "wireless headphones",
      shortDescription: "High-fidelity Wireless Headphones",
      publicDescription: "Noise-cancelling wireless headphones.",
      searchText: "Wireless Headphones electronics audio",
      searchableAttributes: {},
      filterableAttributes: {},
      variantOptions: {},
      condition: "NEW" as const,
      fulfilmentMode: "COURIER_DELIVERY" as const,
      sellingUnit: "EACH" as const,
      priceVersionId: priceHeadphones.id,
      pricePublicReference: "prc_headphones",
      priceAmount: "800.00",
      currency: "ZAR",
      priceIncludesTax: true,
      inventoryTrackingMode: "TRACKED" as const,
      availabilityState: "IN_STOCK" as const,
      primaryMediaPublicReference: null,
      searchable: true,
      indexable: true,
      status: "ACTIVE" as const,
      publishedAt: new Date(),
      sourceUpdatedAt: new Date(),
      indexedAt: new Date(),
    },
  ];

  for (const sfDoc of sfDocs) {
    await prisma.storefrontProductDocument.upsert({
      where: { publicReference: sfDoc.publicReference },
      update: { title: sfDoc.title, priceAmount: sfDoc.priceAmount, status: "ACTIVE", searchable: true, indexable: true },
      create: sfDoc,
    });
  }
}

async function main() {
  // The search adapter uses pg_trgm's similarity() for fuzzy matching.
  // Install it in the E2E database before any storefront search is executed.
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  const [customer, region] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "customer@ktcouriers.local" } }),
    prisma.deliveryRegion.findUniqueOrThrow({ where: { slug: "johannesburg-metro" } }),
  ]);
  await upsertStore("e2e-store@ktcouriers.local", "e2e-store", "E2E Store", passwordHash);
  await upsertStore("e2e-other-store@ktcouriers.local", "e2e-other-store", "E2E Other Store", passwordHash);
  for (const orderNumber of ["E2E-DISPATCH-001", "E2E-DISPATCH-002"]) {
    const quote = await prisma.pricingQuote.create({
      data: {
        status: "ACTIVE", ownerType: "CUSTOMER", ownerId: customer.id, deliveryType: DeliveryType.SAME_DAY, currency: "ZAR", calculationVersion: "e2e", inputHash: "a".repeat(64), distanceMeters: 5000,
        rawDistanceKm: "5.0000", billableDistanceKm: "5.0000", subtotal: "75.00", taxRate: "0.0000", taxAmount: "0.00", total: "75.00",
        inputSnapshot: {}, ruleSnapshot: {}, regionSnapshot: {}, taxSnapshot: {}, expiresAt: new Date("2035-01-01"),
      },
    });

    await prisma.order.upsert({
      where: { orderNumber },
      update: { status: OrderStatus.CONFIRMED, currentDriverProfileId: null, pricingQuoteId: quote.id, priceEstimate: "75.00", pricingSubtotal: "75.00", pricingTaxAmount: "0.00", pricingTaxRate: "0.0000", pricingSnapshot: { quoteId: quote.id, calculationVersion: "e2e", fixture: "e2e" } },
      create: { orderNumber, source: OrderSource.CUSTOMER, status: OrderStatus.CONFIRMED, deliveryType: DeliveryType.SAME_DAY, currency: "ZAR", customerId: customer.id, deliveryRegionId: region.id, recipientName: "E2E Recipient", recipientPhone: "+27110000000", parcelCount: 1, pricingQuoteId: quote.id, priceEstimate: "75.00", pricingSubtotal: "75.00", pricingTaxAmount: "0.00", pricingTaxRate: "0.0000", pricingSnapshot: { quoteId: quote.id, calculationVersion: "e2e", fixture: "e2e" } },
    });
  }

  const deniedLedgerAdmin = await prisma.user.upsert({
    where: { email: "e2e-ledger-denied@ktcouriers.local" },
    update: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, passwordHash },
    create: { email: "e2e-ledger-denied@ktcouriers.local", name: "E2E Ledger Denied", role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), passwordHash, adminProfile: { create: { displayName: "E2E Ledger Denied" } } },
  });
  const ledgerPermission = await prisma.permission.findUniqueOrThrow({ where: { key: "ledger.read" } });
  await prisma.userPermission.upsert({
    where: { userId_permissionId: { userId: deniedLedgerAdmin.id, permissionId: ledgerPermission.id } },
    update: { effect: PermissionEffect.DENY },
    create: { userId: deniedLedgerAdmin.id, permissionId: ledgerPermission.id, effect: PermissionEffect.DENY },
  });

  const cash = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: "PLATFORM-CASH-CLEARING-ZAR" } });
  const adjustment = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: "PLATFORM-ADJUSTMENT-ZAR" } });
  const ledgerFixture = await postLedgerJournal({
    idempotencyKey: "e2e-ledger-balanced-v1",
    type: "GENERAL",
    currency: "ZAR",
    sourceReference: "fixture:e2e-ledger-balanced-v1",
    correlationId: "e2e-ledger-audit",
    memo: "E2E balanced ledger inspection fixture",
    metadata: { fixture: "ledger-e2e" },
    actor: { kind: "SYSTEM" },
    entries: [
      { accountId: cash.id, direction: "DEBIT", amount: "5.00", lineCode: "E2E-CASH" },
      { accountId: adjustment.id, direction: "CREDIT", amount: "5.00", lineCode: "E2E-CONTROL" },
    ],
  });
  await reverseLedgerJournal({ originalJournalId: ledgerFixture.id, idempotencyKey: "e2e-ledger-reversal-v1", actor: { kind: "SYSTEM" }, memo: "E2E reversal relation fixture" });

  await seedPhase2Fixtures(passwordHash);

  console.log("E2E fixtures are ready.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
