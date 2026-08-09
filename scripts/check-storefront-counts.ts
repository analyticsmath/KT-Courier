import { PrismaClient } from "@prisma/client";
import { getStorefrontHome, listStorefrontCategories, listStorefrontStores } from "../lib/services/storefront-catalog.service";

const prisma = new PrismaClient();

async function main() {
  const prodDocCount = await prisma.storefrontProductDocument.count({ where: { status: "ACTIVE", searchable: true } });
  const catDocCount = await prisma.storefrontCategoryDocument.count();
  const storeDocCount = await prisma.storefrontStoreDocument.count({ where: { publicStatus: "ACTIVE" } });

  console.log("=== STOREFRONT READ MODEL COUNTS ===");
  console.log("StorefrontProductDocument (ACTIVE & searchable):", prodDocCount);
  console.log("StorefrontCategoryDocument:", catDocCount);
  console.log("StorefrontStoreDocument (ACTIVE):", storeDocCount);

  const categories = await listStorefrontCategories();
  console.log("listStorefrontCategories count:", categories.length);

  const stores = await listStorefrontStores({ limit: 12 });
  console.log("listStorefrontStores count:", stores.length);

  const home = await getStorefrontHome();
  console.log("getStorefrontHome newArrivals count:", home.newArrivals.length);
  console.log("getStorefrontHome categories count:", home.categories.length);
  console.log("getStorefrontHome stores count:", home.stores.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
