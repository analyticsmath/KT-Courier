import { PrismaClient, UserRole, UserStatus, StoreStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { catalogPublicReference } from "../lib/catalog/catalog-normalization";
import { buildCatalogPublicationSnapshot } from "../lib/catalog/catalog-publication-snapshot";
import { StorefrontProjectionService } from "../lib/services/storefront-projection.service";
import { rebuildStorefrontStoreDocument } from "../lib/services/storefront-store.service";
import { rebuildStorefrontCategoryDocument } from "../lib/services/storefront-category.service";
import { toInputJsonObject } from "../lib/json/input-json";

const prisma = new PrismaClient();
const projectionService = new StorefrontProjectionService();

const DEMO_PASSWORD = "ChangeMe123!";
const SALT_ROUNDS = 10;

function computeFileSHA256(filePath: string): { checksum: string; byteSize: number } {
  const fullPath = join(process.cwd(), "public", filePath.replace(/^\//, ""));
  if (existsSync(fullPath)) {
    const buffer = readFileSync(fullPath);
    return {
      checksum: createHash("sha256").update(buffer).digest("hex"),
      byteSize: buffer.byteLength,
    };
  }
  const hash = createHash("sha256").update(filePath).digest("hex");
  return { checksum: hash, byteSize: 85000 };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  const isLocalDb =
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("db:5432") ||
    dbUrl.includes("db:5433");

  if (process.env.NODE_ENV === "production" || !isLocalDb) {
    throw new Error(
      "❌ ERROR: Development marketplace seed script refused to run! Must run in development against a local database."
    );
  }

  console.log("🛒 Starting KT Couriers local marketplace data seeding...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // Get or create admin user for createdByUserId
  const adminUser = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
  if (!adminUser) throw new Error("Super Admin user not found. Please run main seed first.");
  const adminId = adminUser.id;

  // Clean old dev media assets if present
  await prisma.catalogProductMedia.deleteMany({ where: { asset: { publicReference: { startsWith: "CMA-DEV-" } } } });
  await prisma.catalogMediaAsset.deleteMany({ where: { publicReference: { startsWith: "CMA-DEV-" } } });

  // 1. Seed Product Type Definitions
  console.log("   📦 Seeding Product Type Definitions...");
  const productTypes = [
    { code: "GROCERIES", name: "Groceries & Food", searchFacetSchema: { facets: [{ code: "brand", public: true }] } },
    { code: "HEALTH_WELLNESS", name: "Health & Wellness", searchFacetSchema: { facets: [{ code: "brand", public: true }] } },
    { code: "PREPARED_FOOD", name: "Prepared Food & Bakery", searchFacetSchema: { facets: [{ code: "brand", public: true }] } },
    { code: "ELECTRONICS", name: "Electronics & Tech", searchFacetSchema: { facets: [{ code: "brand", public: true }] } },
    { code: "FASHION", name: "Fashion & Apparel", searchFacetSchema: { facets: [{ code: "brand", public: true }] } },
    { code: "HOME_LIVING", name: "Home & Living", searchFacetSchema: { facets: [{ code: "brand", public: true }] } },
    { code: "OFFICE_SUPPLIES", name: "Office Supplies", searchFacetSchema: { facets: [{ code: "brand", public: true }] } },
  ];

  const productTypeMap = new Map<string, { id: string; code: string; versionNumber: number }>();
  for (const pt of productTypes) {
    const record = await prisma.productTypeDefinition.upsert({
      where: { code_versionNumber: { code: pt.code, versionNumber: 1 } },
      update: { name: pt.name, status: "ACTIVE" },
      create: {
        publicReference: catalogPublicReference("PTD"),
        code: pt.code,
        versionNumber: 1,
        name: pt.name,
        status: "ACTIVE",
        searchFacetSchema: pt.searchFacetSchema,
        attributeSchema: {},
        variantSchema: {},
        complianceSchema: {},
        createdByUserId: adminId,
      },
    });
    productTypeMap.set(pt.code, { id: record.id, code: record.code, versionNumber: record.versionNumber });
  }

  // 2. Seed Categories
  console.log("   🏷️  Seeding Taxonomy Categories...");
  const categoriesData = [
    { ref: "CC-GROCERIES", name: "Groceries", slug: "groceries", path: "groceries", desc: "Fresh food, pantry staples, and everyday household essentials.", ptCode: "GROCERIES" },
    { ref: "CC-FRESH-PRODUCE", name: "Fresh Produce", slug: "fresh-produce", path: "groceries/fresh-produce", desc: "Farm-fresh fruits and vegetables.", parentRef: "CC-GROCERIES", ptCode: "GROCERIES" },
    { ref: "CC-DAIRY-EGGS", name: "Dairy & Eggs", slug: "dairy-eggs", path: "groceries/dairy-eggs", desc: "Fresh milk, cheese, butter, and farm eggs.", parentRef: "CC-GROCERIES", ptCode: "GROCERIES" },
    { ref: "CC-PANTRY", name: "Pantry Essentials", slug: "pantry", path: "groceries/pantry", desc: "Grains, spices, oils, canned goods, and condiments.", parentRef: "CC-GROCERIES", ptCode: "GROCERIES" },

    { ref: "CC-PHARMACY", name: "Pharmacy & Health", slug: "pharmacy", path: "pharmacy", desc: "Wellness products, personal care, and vitamins.", ptCode: "HEALTH_WELLNESS" },
    { ref: "CC-PERSONAL-CARE", name: "Personal Care", slug: "personal-care", path: "pharmacy/personal-care", desc: "Skincare, haircare, and hygiene products.", parentRef: "CC-PHARMACY", ptCode: "HEALTH_WELLNESS" },
    { ref: "CC-VITAMINS", name: "Vitamins & Supplements", slug: "vitamins", path: "pharmacy/vitamins", desc: "Daily vitamins and health supplements.", parentRef: "CC-PHARMACY", ptCode: "HEALTH_WELLNESS" },

    { ref: "CC-RESTAURANT", name: "Prepared Foods & Bakery", slug: "prepared-food", path: "prepared-food", desc: "Artisanal bakery items, fresh coffee, and ready meals.", ptCode: "PREPARED_FOOD" },
    { ref: "CC-BAKERY", name: "Fresh Bakery", slug: "bakery", path: "prepared-food/bakery", desc: "Freshly baked bread, pastries, and cakes.", parentRef: "CC-RESTAURANT", ptCode: "PREPARED_FOOD" },
    { ref: "CC-BEVERAGES", name: "Beverages & Coffee", slug: "beverages", path: "prepared-food/beverages", desc: "Specialty coffee beans, teas, and fresh juices.", parentRef: "CC-RESTAURANT", ptCode: "PREPARED_FOOD" },

    { ref: "CC-ELECTRONICS", name: "Electronics & Tech", slug: "electronics", path: "electronics", desc: "Gadgets, cables, chargers, and mobile accessories.", ptCode: "ELECTRONICS" },
    { ref: "CC-MOBILE-ACC", name: "Mobile Accessories", slug: "mobile-accessories", path: "electronics/mobile-accessories", desc: "Cases, screen protectors, and charging cables.", parentRef: "CC-ELECTRONICS", ptCode: "ELECTRONICS" },

    { ref: "CC-FASHION", name: "Fashion & Apparel", slug: "fashion", path: "fashion", desc: "Local clothing brands, accessories, and footwear.", ptCode: "FASHION" },
    { ref: "CC-HOME", name: "Home & Living", slug: "home-living", path: "home-living", desc: "Home decor, candles, kitchenware, and textiles.", ptCode: "HOME_LIVING" },
    { ref: "CC-OFFICE", name: "Office Supplies", slug: "office-supplies", path: "office-supplies", desc: "Stationery, notebooks, pens, and desk organisation.", ptCode: "OFFICE_SUPPLIES" },
  ];

  const categoryMap = new Map<string, { id: string; publicReference: string; path: string; name: string }>();

  for (const c of categoriesData.filter((cat) => !cat.parentRef)) {
    const record = await prisma.catalogCategory.upsert({
      where: { publicReference: c.ref },
      update: { name: c.name, path: c.path, status: "ACTIVE", createdByUserId: adminId, updatedByUserId: adminId },
      create: {
        publicReference: c.ref,
        name: c.name,
        slug: c.slug,
        path: c.path,
        description: c.desc,
        status: "ACTIVE",
        createdByUserId: adminId,
        updatedByUserId: adminId,
      },
    });
    categoryMap.set(c.ref, { id: record.id, publicReference: record.publicReference, path: record.path, name: record.name });

    const pt = productTypeMap.get(c.ptCode);
    if (pt) {
      await prisma.catalogCategoryProductType.upsert({
        where: { categoryId_productTypeDefinitionId: { categoryId: record.id, productTypeDefinitionId: pt.id } },
        update: { isPrimary: true },
        create: { categoryId: record.id, productTypeDefinitionId: pt.id, isPrimary: true },
      });
    }
  }

  for (const c of categoriesData.filter((cat) => cat.parentRef)) {
    const parent = categoryMap.get(c.parentRef!);
    const record = await prisma.catalogCategory.upsert({
      where: { publicReference: c.ref },
      update: { name: c.name, path: c.path, status: "ACTIVE", parentId: parent?.id, createdByUserId: adminId, updatedByUserId: adminId },
      create: {
        publicReference: c.ref,
        name: c.name,
        slug: c.slug,
        path: c.path,
        description: c.desc,
        status: "ACTIVE",
        parentId: parent?.id,
        createdByUserId: adminId,
        updatedByUserId: adminId,
      },
    });
    categoryMap.set(c.ref, { id: record.id, publicReference: record.publicReference, path: record.path, name: record.name });

    const pt = productTypeMap.get(c.ptCode);
    if (pt) {
      await prisma.catalogCategoryProductType.upsert({
        where: { categoryId_productTypeDefinitionId: { categoryId: record.id, productTypeDefinitionId: pt.id } },
        update: { isPrimary: true },
        create: { categoryId: record.id, productTypeDefinitionId: pt.id, isPrimary: true },
      });
    }
  }

  // 3. Seed Store Owners & Stores
  console.log("   🏪 Seeding Stores & Merchant Profiles...");
  const storesData = [
    { email: "owner.groceries@ktcouriers.local", name: "Fresh Basket Grocers", slug: "fresh-basket-grocers", desc: "Your local neighbourhood grocer offering fresh produce, dairy, and daily essentials.", categoryCode: "GROCERIES" },
    { email: "owner.pharmacy@ktcouriers.local", name: "CarePlus Health & Wellness", slug: "careplus-wellness", desc: "Trusted local pharmacy providing vitamins, skincare, and wellness products.", categoryCode: "HEALTH_WELLNESS" },
    { email: "owner.bakery@ktcouriers.local", name: "Artisan Bakery & Cafe", slug: "artisan-bakery-cafe", desc: "Fresh sourdough, artisanal pastries, and freshly roasted coffee beans.", categoryCode: "PREPARED_FOOD" },
    { email: "owner.electronics@ktcouriers.local", name: "TechHub South Africa", slug: "techhub-electronics", desc: "Quality electronic accessories, chargers, headphones, and smart home gear.", categoryCode: "ELECTRONICS" },
    { email: "owner.fashion@ktcouriers.local", name: "Cape Threads Studio", slug: "cape-threads-studio", desc: "Sustainably crafted local apparel, leather accessories, and footwear.", categoryCode: "FASHION" },
    { email: "owner.home@ktcouriers.local", name: "Living Spaces & Home", slug: "living-spaces-home", desc: "Handcrafted home decor, scented soy candles, and premium kitchenware.", categoryCode: "HOME_LIVING" },
    { email: "owner.office@ktcouriers.local", name: "Stationery Depot Express", slug: "stationery-depot-express", desc: "Premium paper goods, desk accessories, and office supplies for work and school.", categoryCode: "OFFICE_SUPPLIES" },
  ];

  const storeMap = new Map<string, { id: string; slug: string; name: string }>();

  for (const s of storesData) {
    const ownerUser = await prisma.user.upsert({
      where: { email: s.email },
      update: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      create: {
        email: s.email,
        passwordHash,
        name: `${s.name} Owner`,
        role: UserRole.STORE,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.storeProfile.upsert({
      where: { userId: ownerUser.id },
      update: { status: StoreStatus.ACTIVE },
      create: {
        userId: ownerUser.id,
        storeName: s.name,
        contactPerson: `${s.name} Manager`,
        businessPhone: "+27 21 555 0199",
        businessEmail: s.email,
        status: StoreStatus.ACTIVE,
      },
    });

    const store = await prisma.store.upsert({
      where: { slug: s.slug },
      update: { status: StoreStatus.ACTIVE, ownerUserId: ownerUser.id, name: s.name },
      create: {
        name: s.name,
        slug: s.slug,
        status: StoreStatus.ACTIVE,
        ownerUserId: ownerUser.id,
        contactName: `${s.name} Manager`,
        contactEmail: s.email,
        contactPhone: "+27 21 555 0199",
        featured: true,
      },
    });

    storeMap.set(s.slug, { id: store.id, slug: store.slug, name: store.name });
  }

  // Seed 1 Ineligible Store for Negative-State Testing
  const closedOwner = await prisma.user.upsert({
    where: { email: "owner.closed@ktcouriers.local" },
    update: { status: UserStatus.ACTIVE },
    create: { email: "owner.closed@ktcouriers.local", passwordHash, name: "Closed Store Owner", role: UserRole.STORE, status: UserStatus.ACTIVE },
  });
  await prisma.store.upsert({
    where: { slug: "closed-corner-store" },
    update: { status: StoreStatus.PENDING },
    create: { name: "Closed Corner Store", slug: "closed-corner-store", status: StoreStatus.PENDING, ownerUserId: closedOwner.id },
  });

  // 4. Seed Local Catalog Media Assets
  console.log("   🖼️  Seeding Catalog Media Assets...");
  const mediaFiles = [
    { key: "/images/kt-couriers/box-sealing-order-prep.webp", alt: "Fresh product box packaging" },
    { key: "/images/kt-couriers/small-business-delivery-counter.webp", alt: "Local retail shop counter" },
    { key: "/images/kt-couriers/store-merchandise-packing.webp", alt: "Store merchandise packed for courier delivery" },
    { key: "/images/kt-couriers/labelled-parcel-preparation.webp", alt: "Labelled delivery parcel" },
    { key: "/images/kt-couriers/hands-exchanging-delivery-packages.webp", alt: "Handing over customer order" },
    { key: "/images/kt-couriers/parcel-packing-close-up.webp", alt: "Order packing close-up" },
    { key: "/images/kt-couriers/parcel-handoff-customer.webp", alt: "Parcel handoff to customer" },
  ];

  const mediaAssetMap = new Map<string, { id: string; publicReference: string; width: number; height: number }>();
  const now = new Date();

  for (let i = 0; i < mediaFiles.length; i++) {
    const item = mediaFiles[i]!;
    const ref = `CMA-DEV-${i + 101}`;
    const { checksum, byteSize } = computeFileSHA256(item.key);
    const storageKey = `catalog-media/${checksum}`;

    const asset = await prisma.catalogMediaAsset.upsert({
      where: { publicReference: ref },
      update: {},
      create: {
        publicReference: ref,
        ownerType: "PLATFORM",
        ownerStoreId: null,
        purpose: "PRODUCT_IMAGE",
        storageKey,
        storageProvider: "LOCAL_DEV",
        declaredMimeType: "image/webp",
        mimeType: "image/webp",
        declaredByteSize: byteSize,
        byteSize,
        width: 1200,
        height: 1200,
        checksum,
        privacyInspectionPassed: true,
        status: "READY",
        storageConfirmedAt: now,
        validatedAt: now,
        createdByUserId: adminId,
        updatedByUserId: adminId,
      },
    });

    mediaAssetMap.set(ref, { id: asset.id, publicReference: asset.publicReference, width: 1200, height: 1200 });
  }

  const mediaAssetList = Array.from(mediaAssetMap.values());

  // 5. Seed Products, Variants, Offers, Prices, Snapshots, and Projections
  console.log("   🛒 Seeding Catalog Products & Compiling Snapshots...");

  const rawProductsData = [
    // Groceries Store Products
    { storeSlug: "fresh-basket-grocers", catRef: "CC-FRESH-PRODUCE", ptCode: "GROCERIES", title: "Organic Hass Avocados (Pack of 4)", price: "48.50", desc: "Creamy, ready-to-eat organic Hass avocados sourced directly from Western Cape orchards.", variants: [{ name: "Standard 4-Pack", price: "48.50" }, { name: "Bulk 8-Pack", price: "89.00" }] },
    { storeSlug: "fresh-basket-grocers", catRef: "CC-FRESH-PRODUCE", ptCode: "GROCERIES", title: "Fresh Gala Apples (1.5kg Bag)", price: "34.90", desc: "Crisp and sweet local Gala apples, perfect for snacking.", variants: [{ name: "1.5kg Bag", price: "34.90" }] },
    { storeSlug: "fresh-basket-grocers", catRef: "CC-DAIRY-EGGS", ptCode: "GROCERIES", title: "Free-Range Large Eggs (18 Count)", price: "62.00", desc: "Farm fresh free-range eggs from ethically raised hens.", variants: [{ name: "18 Count", price: "62.00" }, { name: "30 Count Tray", price: "98.00" }] },
    { storeSlug: "fresh-basket-grocers", catRef: "CC-DAIRY-EGGS", ptCode: "GROCERIES", title: "Full Cream Fresh Milk (2L)", price: "36.50", desc: "Pure full cream pasteurised fresh milk.", variants: [{ name: "2L Bottle", price: "36.50" }] },
    { storeSlug: "fresh-basket-grocers", catRef: "CC-PANTRY", ptCode: "GROCERIES", title: "Extra Virgin Olive Oil (750ml)", price: "145.00", desc: "First cold-pressed South African extra virgin olive oil.", variants: [{ name: "750ml Bottle", price: "145.00" }] },
    { storeSlug: "fresh-basket-grocers", catRef: "CC-PANTRY", ptCode: "GROCERIES", title: "Artisanal Raw Fynbos Honey (500g)", price: "85.00", desc: "Unfiltered raw wild fynbos honey harvest.", variants: [{ name: "500g Glass Jar", price: "85.00" }] },
    { storeSlug: "fresh-basket-grocers", catRef: "CC-PANTRY", ptCode: "GROCERIES", title: "Stone-Ground Wholewheat Flour (2.5kg)", price: "42.00", desc: "Unbleached stone-ground wholewheat flour for home baking.", variants: [{ name: "2.5kg Bag", price: "42.00" }] },

    // CarePlus Pharmacy Products
    { storeSlug: "careplus-wellness", catRef: "CC-VITAMINS", ptCode: "HEALTH_WELLNESS", title: "Vitamin C 1000mg Effervescent (20 Tablets)", price: "79.00", desc: "High-potency immune support effervescent tablets with zinc.", variants: [{ name: "Orange 20s", price: "79.00" }, { name: "Citrus 40s Double Pack", price: "139.00" }] },
    { storeSlug: "careplus-wellness", catRef: "CC-VITAMINS", ptCode: "HEALTH_WELLNESS", title: "Omega-3 Deep Sea Fish Oil (90 Softgels)", price: "189.00", desc: "Purified EPA & DHA essential fatty acids for heart and brain health.", variants: [{ name: "90 Softgels", price: "189.00" }] },
    { storeSlug: "careplus-wellness", catRef: "CC-PERSONAL-CARE", ptCode: "HEALTH_WELLNESS", title: "Hydrating Botanical Body Wash (500ml)", price: "115.00", desc: "Sulphate-free aloe vera and chamomile gentle cleanser.", variants: [{ name: "500ml Pump", price: "115.00" }] },
    { storeSlug: "careplus-wellness", catRef: "CC-PERSONAL-CARE", ptCode: "HEALTH_WELLNESS", title: "SPF 50+ Mineral Sunscreen Lotion (150ml)", price: "210.00", desc: "Broad spectrum water-resistant reef-safe sunscreen.", variants: [{ name: "150ml Tube", price: "210.00" }] },
    { storeSlug: "careplus-wellness", catRef: "CC-PERSONAL-CARE", ptCode: "HEALTH_WELLNESS", title: "Organic Tea Tree Essential Oil (15ml)", price: "68.00", desc: "Pure steam-distilled tea tree oil for skin and aromatherapy.", variants: [{ name: "15ml Dropper", price: "68.00" }] },

    // Artisan Bakery & Cafe Products
    { storeSlug: "artisan-bakery-cafe", catRef: "CC-BAKERY", ptCode: "PREPARED_FOOD", title: "Country Sourdough Bread Loaf", price: "45.00", desc: "36-hour naturally fermented slow-baked country sourdough.", variants: [{ name: "Whole Loaf (800g)", price: "45.00" }, { name: "Sliced Loaf", price: "47.00" }] },
    { storeSlug: "artisan-bakery-cafe", catRef: "CC-BAKERY", ptCode: "PREPARED_FOOD", title: "French Butter Croissants (Box of 4)", price: "72.00", desc: "Flaky, layered French butter croissants baked fresh daily.", variants: [{ name: "Classic Butter 4-Pack", price: "72.00" }, { name: "Almond Croissant 4-Pack", price: "88.00" }] },
    { storeSlug: "artisan-bakery-cafe", catRef: "CC-BEVERAGES", ptCode: "PREPARED_FOOD", title: "Single Origin Espresso Beans (1kg)", price: "285.00", desc: "Medium-dark roast specialty Arabica beans with chocolate & berry notes.", variants: [{ name: "Whole Bean 1kg", price: "285.00" }, { name: "Espresso Grind 1kg", price: "285.00" }] },
    { storeSlug: "artisan-bakery-cafe", catRef: "CC-BEVERAGES", ptCode: "PREPARED_FOOD", title: "Artisanal Cold Brew Coffee (330ml Can)", price: "38.00", desc: "Steeped for 18 hours for a smooth, refreshing caffeine kick.", variants: [{ name: "Single Can", price: "38.00" }, { name: "6-Can Pack", price: "210.00" }] },
    { storeSlug: "artisan-bakery-cafe", catRef: "CC-BAKERY", ptCode: "PREPARED_FOOD", title: "Decadent Dark Chocolate Brownies (Box of 6)", price: "95.00", desc: "Fudgy 70% Valrhona dark chocolate brownies with sea salt flakes.", variants: [{ name: "Box of 6", price: "95.00" }] },

    // TechHub Electronics Products
    { storeSlug: "techhub-electronics", catRef: "CC-MOBILE-ACC", ptCode: "ELECTRONICS", title: "Fast-Charge USB-C Braided Cable (2m)", price: "165.00", desc: "Heavy-duty nylon braided 100W Power Delivery USB-C cable.", variants: [{ name: "2m Black", price: "165.00" }, { name: "2m Silver", price: "165.00" }] },
    { storeSlug: "techhub-electronics", catRef: "CC-MOBILE-ACC", ptCode: "ELECTRONICS", title: "Dual USB-C 65W GaN Wall Charger", price: "499.00", desc: "Compact Gallium Nitride fast charger for laptops, tablets, and phones.", variants: [{ name: "65W GaN Plug", price: "499.00" }] },
    { storeSlug: "techhub-electronics", catRef: "CC-ELECTRONICS", ptCode: "ELECTRONICS", title: "Magnetic Wireless Power Bank 10,000mAh", price: "649.00", desc: "MagSafe compatible portable power bank with stand.", variants: [{ name: "10,000mAh Power Bank", price: "649.00" }] },
    { storeSlug: "techhub-electronics", catRef: "CC-ELECTRONICS", ptCode: "ELECTRONICS", title: "Noise-Isolating Bluetooth Earbuds", price: "890.00", desc: "True wireless stereo earbuds with ANC and 28-hour battery life.", variants: [{ name: "Matte Black", price: "890.00" }, { name: "Pure White", price: "890.00" }] },

    // Cape Threads Studio Products
    { storeSlug: "cape-threads-studio", catRef: "CC-FASHION", ptCode: "FASHION", title: "Heavyweight Linen Unisex Oversized Shirt", price: "650.00", desc: "100% pure South African flax linen shirt, relaxed breathable fit.", variants: [{ name: "Natural Flax - M", price: "650.00" }, { name: "Natural Flax - L", price: "650.00" }, { name: "Navy Blue - M", price: "650.00" }] },
    { storeSlug: "cape-threads-studio", catRef: "CC-FASHION", ptCode: "FASHION", title: "Handcrafted Full-Grain Leather Tote Bag", price: "1250.00", desc: "Locally stitched vegetable-tanned bovine leather tote bag.", variants: [{ name: "Tan Brown", price: "1250.00" }, { name: "Classic Black", price: "1250.00" }] },
    { storeSlug: "cape-threads-studio", catRef: "CC-FASHION", ptCode: "FASHION", title: "Organic Cotton Daily Crew Socks (3-Pack)", price: "180.00", desc: "Reinforced heel and toe combed organic cotton socks.", variants: [{ name: "Earth Tones Pack", price: "180.00" }] },

    // Living Spaces & Home Products
    { storeSlug: "living-spaces-home", catRef: "CC-HOME", ptCode: "HOME_LIVING", title: "Handcrafted Ceramic Coffee Mugs (Set of 2)", price: "320.00", desc: "Speckled stoneware ceramic mugs, hand-thrown by Cape artisans.", variants: [{ name: "Speckled Oatmeal", price: "320.00" }, { name: "Ocean Slate", price: "320.00" }] },
    { storeSlug: "living-spaces-home", catRef: "CC-HOME", ptCode: "HOME_LIVING", title: "Fynbos & Amber Soy Scented Candle (300g)", price: "240.00", desc: "Hand-poured 100% natural soy wax candle with wooden wick.", variants: [{ name: "300g Glass Vessel", price: "240.00" }] },
    { storeSlug: "living-spaces-home", catRef: "CC-HOME", ptCode: "HOME_LIVING", title: "Woven Cotton Throw Blanket (150x200cm)", price: "590.00", desc: "Breathable textured cotton throw blanket with fringe detail.", variants: [{ name: "Charcoal Grey", price: "590.00" }, { name: "Terracotta", price: "590.00" }] },

    // Stationery Depot Express Products
    { storeSlug: "stationery-depot-express", catRef: "CC-OFFICE", ptCode: "OFFICE_SUPPLIES", title: "Hardcover Bullet Grid Journal (A5, 192p)", price: "195.00", desc: "120gsm fountain-pen friendly acid-free paper journal with ribbon marker.", variants: [{ name: "Sage Green", price: "195.00" }, { name: "Midnight Blue", price: "195.00" }] },
    { storeSlug: "stationery-depot-express", catRef: "CC-OFFICE", ptCode: "OFFICE_SUPPLIES", title: "Precision Gel Ink Pens 0.5mm (Set of 5)", price: "120.00", desc: "Smooth quick-dry Japanese archival ink gel pens.", variants: [{ name: "Black Ink 5-Pack", price: "120.00" }] },
    { storeSlug: "stationery-depot-express", catRef: "CC-OFFICE", ptCode: "OFFICE_SUPPLIES", title: "Minimalist Felt Desk Mat (80x40cm)", price: "280.00", desc: "Non-slip wool felt desk pad for laptop and mouse protection.", variants: [{ name: "Dark Grey Felt", price: "280.00" }] },
  ];

  let publishedSnapshotCount = 0;

  for (let idx = 0; idx < rawProductsData.length; idx++) {
    const pData = rawProductsData[idx]!;
    const store = storeMap.get(pData.storeSlug);
    const category = categoryMap.get(pData.catRef);
    const productType = productTypeMap.get(pData.ptCode);

    if (!store || !category || !productType) continue;

    const prodRef = `CP-DEV-${1000 + idx}`;
    const slug = `${pData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${prodRef.toLowerCase()}`;
    const normTitle = pData.title.toUpperCase();

    // Step 1: Create product in DRAFT status with APPROVED moderationStatus & PUBLISHED publicationStatus
    const product = await prisma.catalogProduct.upsert({
      where: { publicReference: prodRef },
      update: { title: pData.title, createdByUserId: adminId },
      create: {
        publicReference: prodRef,
        title: pData.title,
        normalizedTitle: normTitle,
        slug,
        scope: "GLOBAL_CANONICAL",
        status: "DRAFT",
        moderationStatus: "APPROVED",
        publicationStatus: "PUBLISHED",
        version: 1,
        shortDescription: pData.desc,
        description: pData.desc,
        condition: "NEW",
        primaryCategoryId: category.id,
        productTypeDefinitionId: productType.id,
        productTypeVersionNumber: productType.versionNumber,
        attributeValues: {},
        complianceValues: {},
        qualityIssues: [],
        createdByUserId: adminId,
      },
    });

    // Attach Media
    const mediaAsset = mediaAssetList[idx % mediaAssetList.length]!;
    await prisma.catalogProductMedia.deleteMany({ where: { productId: product.id } });
    await prisma.catalogProductMedia.create({
      data: {
        productId: product.id,
        assetId: mediaAsset.id,
        role: "PRIMARY",
        altText: pData.title,
        displayOrder: 1,
      },
    });

    // Step 2: Create Variants & Offers
    const createdVariantIds: string[] = [];
    for (let vIdx = 0; vIdx < pData.variants.length; vIdx++) {
      const varData = pData.variants[vIdx]!;
      const varRef = `CPV-DEV-${1000 + idx}-${vIdx + 1}`;

      const variant = await prisma.catalogProductVariant.upsert({
        where: { publicReference: varRef },
        update: { title: varData.name, status: "ACTIVE" },
        create: {
          publicReference: varRef,
          productId: product.id,
          title: varData.name,
          normalizedTitle: varData.name.toUpperCase(),
          optionFingerprint: varRef,
          skuReference: `SKU-${1000 + idx}-${vIdx + 1}`,
          status: "ACTIVE",
          attributeValues: {},
        },
      });
      createdVariantIds.push(variant.id);
    }

    // Step 3: Now update Product to ACTIVE
    await prisma.catalogProduct.update({
      where: { id: product.id },
      data: { status: "ACTIVE", moderationStatus: "APPROVED", publicationStatus: "PUBLISHED" },
    });

    // Step 4: Create Offers & Price Versions
    for (let vIdx = 0; vIdx < pData.variants.length; vIdx++) {
      const varData = pData.variants[vIdx]!;
      const varRef = `CPV-DEV-${1000 + idx}-${vIdx + 1}`;
      const offerRef = `SCO-DEV-${1000 + idx}-${vIdx + 1}`;
      const priceRef = `SOPV-DEV-${1000 + idx}-${vIdx + 1}`;
      const variantId = createdVariantIds[vIdx]!;

      // 4a. Create offer in DRAFT status
      const offer = await prisma.storeCatalogOffer.upsert({
        where: { publicReference: offerRef },
        update: { publicationStatus: "PUBLISHED" },
        create: {
          publicReference: offerRef,
          storeId: store.id,
          productId: product.id,
          variantId,
          storeSku: `SKU-${1000 + idx}-${vIdx + 1}`,
          fulfilmentMode: "COURIER_DELIVERY",
          sellingUnit: "EACH",
          status: "DRAFT",
          publicationStatus: "PUBLISHED",
          inventoryTrackingMode: "TRACKED",
          createdByUserId: adminId,
        },
      });

      // 4b. Create price version
      const priceAmount = Number(varData.price);
      const priceVersion = await prisma.storeOfferPriceVersion.upsert({
        where: { publicReference: priceRef },
        update: { amount: priceAmount, status: "ACTIVE" },
        create: {
          publicReference: priceRef,
          offerId: offer.id,
          versionNumber: 1,
          amount: priceAmount,
          currency: "ZAR",
          priceIncludesTax: true,
          status: "ACTIVE",
          effectiveFrom: new Date(Date.now() - 86400000),
          createdByUserId: adminId,
        },
      });

      // 4c. Update offer to ACTIVE with currentPriceVersionId
      await prisma.storeCatalogOffer.update({
        where: { id: offer.id },
        data: { currentPriceVersionId: priceVersion.id, status: "ACTIVE", publicationStatus: "PUBLISHED" },
      });

      // Inventory Item
      const invItem = await prisma.catalogInventoryItem.upsert({
        where: { offerId: offer.id },
        update: {},
        create: {
          publicReference: `CII-DEV-${1000 + idx}-${vIdx + 1}`,
          offerId: offer.id,
          variantId,
          trackingMode: "TRACKED",
        },
      });

      const invLoc = await prisma.inventoryLocation.upsert({
        where: { storeId_name: { storeId: store.id, name: "Main Store Floor" } },
        update: {},
        create: {
          publicReference: `IL-DEV-${store.id}`,
          storeId: store.id,
          name: "Main Store Floor",
          status: "ACTIVE",
          isPrimary: true,
        },
      });

      // Inventory Movement Evidence
      const opId = `OP-DEV-${1000 + idx}-${vIdx + 1}`;
      const cimRef = `CIM-DEV-${1000 + idx}-${vIdx + 1}`;
      const reqHash = createHash("sha256").update(opId).digest("hex");
      const existingMovement = await prisma.catalogInventoryMovement.findUnique({
        where: { inventoryItemId_operationId: { inventoryItemId: invItem.id, operationId: opId } },
      });

      if (!existingMovement) {
        await prisma.catalogInventoryMovement.create({
          data: {
            publicReference: cimRef,
            inventoryItemId: invItem.id,
            locationId: invLoc.id,
            type: "INITIAL_STOCK",
            quantityDelta: 50,
            operationId: opId,
            requestHash: reqHash,
            reasonCode: "INITIAL_DEV_SEED",
            safeNote: "Initial stock count for local development testing",
            actorUserId: adminId,
            resultingOnHand: 50,
          },
        });
      }

      await prisma.catalogInventoryLevel.upsert({
        where: { inventoryItemId_locationId: { inventoryItemId: invItem.id, locationId: invLoc.id } },
        update: { available: 50, onHand: 50, reserved: 0 },
        create: {
          inventoryItemId: invItem.id,
          locationId: invLoc.id,
          available: 50,
          onHand: 50,
          reserved: 0,
        },
      });

      // Snapshot
      const snapshotRef = `CPS-DEV-${1000 + idx}-${vIdx + 1}`;
      const snapshotPayload = buildCatalogPublicationSnapshot({
        productReference: product.publicReference,
        variantReference: varRef,
        offerReference: offer.publicReference,
        storeReference: store.slug,
        productTypeCode: productType.code,
        productTypeVersion: productType.versionNumber,
        categoryPath: category.path,
        title: product.title,
        description: product.description || "",
        identifiers: {},
        attributes: {},
        variantOptions: { option: varData.name },
        price: {
          versionReference: priceVersion.publicReference,
          amount: priceAmount.toFixed(2),
          currency: "ZAR",
          includesTax: true,
        },
        availability: { state: "IN_STOCK" },
        media: [{ assetReference: mediaAsset.publicReference, role: "PRIMARY", altText: product.title, order: 1 }],
        compliance: {},
      });

      const snapshotRecord = await prisma.catalogPublicationSnapshot.upsert({
        where: { publicReference: snapshotRef },
        update: {},
        create: {
          publicReference: snapshotRef,
          versionNumber: 1,
          publicationVersion: snapshotPayload.publicationVersion,
          productId: product.id,
          variantId,
          offerId: offer.id,
          status: "PUBLISHED",
          snapshot: toInputJsonObject(snapshotPayload),
          createdByUserId: adminId,
        },
      });

      // Compile StorefrontProductDocument
      await projectionService.buildPublishedSnapshot(snapshotRecord.publicReference);
      publishedSnapshotCount++;
    }
  }

  console.log(`   ✓ ${publishedSnapshotCount} catalog snapshots compiled into StorefrontProductDocuments`);

  // Seed Negative Testing Records (Draft product, Retired product, Out of stock)
  console.log("   🧪 Seeding Deliberate Ineligible Records for Negative Testing...");
  const draftProdRef = "CP-DEV-DRAFT-999";
  await prisma.catalogProduct.upsert({
    where: { publicReference: draftProdRef },
    update: { publicationStatus: "DRAFT" },
    create: {
      publicReference: draftProdRef,
      title: "Draft Unreleased Gadget",
      normalizedTitle: "DRAFT UNRELEASED GADGET",
      slug: "draft-unreleased-gadget",
      scope: "GLOBAL_CANONICAL",
      status: "DRAFT",
      publicationStatus: "DRAFT",
      version: 1,
      primaryCategoryId: categoryMap.get("CC-ELECTRONICS")!.id,
      productTypeDefinitionId: productTypeMap.get("ELECTRONICS")!.id,
      productTypeVersionNumber: 1,
      attributeValues: {},
      complianceValues: {},
      qualityIssues: [],
      createdByUserId: adminId,
    },
  });

  // 6. Rebuild StorefrontStoreDocument & StorefrontCategoryDocument
  console.log("   🔄 Compiling StorefrontStoreDocuments & StorefrontCategoryDocuments...");
  for (const s of storeMap.values()) {
    await rebuildStorefrontStoreDocument(s.id);
  }
  for (const c of categoryMap.values()) {
    await rebuildStorefrontCategoryDocument(c.id);
  }

  // 7. Seed Storefront Collections
  console.log("   📚 Seeding Storefront Collections...");
  const collectionsData = [
    { ref: "SFC-NEW-ARRIVALS", slug: "new-arrivals", name: "New Arrivals", desc: "Discover fresh arrivals across local independent stores." },
    { ref: "SFC-EVERYDAY-ESSENTIALS", slug: "everyday-essentials", name: "Everyday Essentials", desc: "Daily household, pantry, and personal care staples." },
    { ref: "SFC-LOCAL-FAVOURITES", slug: "local-favourites", name: "Local Favourites", desc: "Top picks from neighbourhood artisans and cafes." },
    { ref: "SFC-OFFICE-ESSENTIALS", slug: "office-essentials", name: "Office Essentials", desc: "Quality paper goods and desk supplies for productive days." },
  ];

  for (const col of collectionsData) {
    // Check if collection exists
    let existingCol = await prisma.storefrontCollection.findUnique({ where: { publicReference: col.ref } });
    if (!existingCol) {
      // Create in DRAFT status first
      existingCol = await prisma.storefrontCollection.create({
        data: {
          publicReference: col.ref,
          slug: col.slug,
          name: col.name,
          description: col.desc,
          collectionType: "EDITORIAL",
          status: "DRAFT",
          seoIndexable: true,
          createdByUserId: adminId,
        },
      });
      // Attach items while in DRAFT status if everyday essentials
      if (col.ref === "SFC-EVERYDAY-ESSENTIALS") {
        await prisma.storefrontCollectionItem.createMany({
          data: [
            { collectionId: existingCol.id, targetType: "PRODUCT", targetReference: "CP-DEV-1000", sourceVersion: "DEV-V1", displayOrder: 1 },
            { collectionId: existingCol.id, targetType: "PRODUCT", targetReference: "CP-DEV-1003", sourceVersion: "DEV-V1", displayOrder: 2 },
            { collectionId: existingCol.id, targetType: "PRODUCT", targetReference: "CP-DEV-1007", sourceVersion: "DEV-V1", displayOrder: 3 },
          ],
        });
      }
      // Activate collection
      await prisma.storefrontCollection.update({
        where: { id: existingCol.id },
        data: { status: "ACTIVE" },
      });
    }
  }

  console.log("🎉 Local marketplace dataset seeding and projection compilation complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
