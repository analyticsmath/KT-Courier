import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";

export async function getCurrentStoreForCatalogPage(permissionKey: string = PERMISSIONS.CATALOG_READ) {
  const access = await requireStoreCatalogPermission(permissionKey);
  if ("response" in access) redirect(access.response.status === 401 ? "/login" : "/store/workspace");
  return access;
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
