import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";
import { disconnectFullDemoSeeder, seedFullDemo } from "./seed-full-demo";

const prisma = new PrismaClient();

function requireProductionCatalogAuthorization(): void {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Production showcase catalogue initializer requires NODE_ENV=production.");
  }
  if (process.env.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() !== "production") {
    throw new Error("Production showcase catalogue initializer requires KT_DATABASE_CLASSIFICATION=production.");
  }
  if (process.env.KT_PRODUCTION_SHOWCASE_CATALOG_SEED !== "true") {
    throw new Error("Production showcase catalogue initializer requires explicit KT_PRODUCTION_SHOWCASE_CATALOG_SEED=true authorization.");
  }
  if (process.env.CATALOG_MEDIA_STORAGE?.trim().toLowerCase() !== "s3") {
    throw new Error("Production showcase catalogue initializer requires durable CATALOG_MEDIA_STORAGE=s3.");
  }
  const bootstrapPassword = process.env.KT_DEMO_ACCOUNT_PASSWORD?.trim() ?? "";
  if (bootstrapPassword.length < 40) {
    throw new Error("KT_DEMO_ACCOUNT_PASSWORD must be a strong deployment-only secret of at least 40 characters.");
  }
}

async function verifyCatalogue(): Promise<void> {
  const [
    stores,
    activeStores,
    products,
    publishedProducts,
    publishedOffers,
    publishedSnapshots,
    activeDocuments,
    activeStoreDocuments,
    categoryDocuments,
  ] = await Promise.all([
    prisma.store.count(),
    prisma.store.count({ where: { status: "ACTIVE" } }),
    prisma.catalogProduct.count(),
    prisma.catalogProduct.count({ where: { status: "ACTIVE", publicationStatus: "PUBLISHED" } }),
    prisma.storeCatalogOffer.count({ where: { status: "ACTIVE", publicationStatus: "PUBLISHED" } }),
    prisma.catalogPublicationSnapshot.count({ where: { status: "PUBLISHED" } }),
    prisma.storefrontProductDocument.count({ where: { status: "ACTIVE", searchable: true } }),
    prisma.storefrontStoreDocument.count({ where: { publicStatus: "ACTIVE" } }),
    prisma.storefrontCategoryDocument.count(),
  ]);

  if (
    stores < 20 ||
    activeStores < 16 ||
    products < 180 ||
    publishedProducts < 180 ||
    publishedOffers < 1 ||
    publishedSnapshots < 1 ||
    activeDocuments < 1 ||
    activeStoreDocuments < 1 ||
    categoryDocuments < 1
  ) {
    throw new Error(
      `Production showcase catalogue verification failed: stores=${stores}, activeStores=${activeStores}, products=${products}, publishedProducts=${publishedProducts}, publishedOffers=${publishedOffers}, snapshots=${publishedSnapshots}, storefrontProducts=${activeDocuments}, storefrontStores=${activeStoreDocuments}, storefrontCategories=${categoryDocuments}.`,
    );
  }

  console.log(JSON.stringify({
    event: "production_showcase_catalogue_ready",
    stores,
    activeStores,
    products,
    publishedProducts,
    publishedOffers,
    publishedSnapshots,
    activeDocuments,
    activeStoreDocuments,
    categoryDocuments,
  }));
}

async function hasExistingCatalogueState(): Promise<boolean> {
  const [mediaAssets, products, stores] = await Promise.all([
    prisma.catalogMediaAsset.count(),
    prisma.catalogProduct.count(),
    prisma.store.count(),
  ]);
  return mediaAssets > 0 || products > 0 || stores > 0;
}

async function main(): Promise<void> {
  requireProductionCatalogAuthorization();

  // Production deploys are not catalogue migrations. Once the showcase catalogue
  // exists, verify it and leave immutable catalog/media declarations untouched.
  if (await hasExistingCatalogueState()) {
    await verifyCatalogue();
    console.log(JSON.stringify({ event: "production_showcase_catalogue_existing" }));
    return;
  }

  await seedFullDemo({
    catalogOnly: true,
    includeDevAuthAccounts: false,
    skipSafetyCheck: true,
    catalogStorageProvider: "S3_COMPATIBLE",
  });
  await verifyCatalogue();

  // The media sync command runs immediately after this script in the same Railway
  // pre-deploy container. This sentinel tells it that this is the one-time bootstrap
  // path and that bundled media must actually be uploaded to durable storage.
  await writeFile("/tmp/kt-showcase-catalog-seeded-now", new Date().toISOString(), "utf8");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Production showcase catalogue initialization failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([prisma.$disconnect(), disconnectFullDemoSeeder()]);
  });
