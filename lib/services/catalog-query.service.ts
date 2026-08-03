import { prisma } from "@/lib/db/prisma";

/** Internal Phase 19/20 read boundary. It returns immutable approved snapshots only. */
export async function getInternalCatalogSnapshot(offerReference: string) {
  return prisma.catalogPublicationSnapshot.findFirst({
    where: { offer: { publicReference: offerReference }, status: "PUBLISHED", supersededAt: null },
    orderBy: { versionNumber: "desc" },
    select: { publicReference: true, publicationVersion: true, snapshot: true, createdAt: true },
  });
}

export async function listCatalogAdminProducts(filters: { page: number; pageSize: number; status?: string; search?: string }) {
  return prisma.catalogProduct.findMany({ where: { ...(filters.status ? { status: filters.status as never } : {}), ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}) }, include: { primaryCategory: true, productTypeDefinition: true, brand: true, variants: true, offers: { include: { store: { select: { name: true, slug: true } }, priceVersions: { orderBy: { versionNumber: "desc" }, take: 1 }, inventoryItem: { include: { levels: true } } } } }, orderBy: { updatedAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize });
}

export async function listCatalogAdminOffers(filters: { page: number; pageSize: number; status?: string }) {
  return prisma.storeCatalogOffer.findMany({ where: filters.status ? { status: filters.status as never } : undefined, include: { store: { select: { name: true, slug: true } }, product: true, variant: true, priceVersions: { orderBy: { versionNumber: "desc" } }, inventoryItem: { include: { levels: true } } }, orderBy: { updatedAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize });
}

