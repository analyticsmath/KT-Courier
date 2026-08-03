import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreByOwner } from "@/lib/services/stores.service";
import { CatalogOwnershipError } from "@/lib/catalog/errors";

export async function getCurrentStoreForCatalogPage() {
  const user = await getCurrentUser();
  const store = user ? await getStoreByOwner(user.id) : null;
  if (!user || !store || store.status !== "ACTIVE") throw new CatalogOwnershipError();
  return { user, store };
}

export async function getStoreCatalogPageSummary(storeId: string) {
  const [products, offers, locations, imports, moderation] = await Promise.all([
    prisma.catalogProduct.count({ where: { sourceStoreId: storeId } }),
    prisma.storeCatalogOffer.count({ where: { storeId } }),
    prisma.inventoryLocation.count({ where: { storeId, status: "ACTIVE" } }),
    prisma.catalogImportJob.count({ where: { storeId, status: { in: ["UPLOADED", "VALIDATING", "VALIDATED", "APPLYING"] } } }),
    prisma.catalogModerationCase.count({ where: { OR: [{ product: { sourceStoreId: storeId } }, { offer: { storeId } }], status: { in: ["OPEN", "UNDER_REVIEW", "NEEDS_CHANGES"] } } }),
  ]);
  return { products, offers, locations, imports, moderation };
}

