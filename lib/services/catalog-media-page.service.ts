import { prisma } from "@/lib/db/prisma";

export async function listStoreCatalogMediaForPage(storeId: string) {
  return prisma.catalogMediaAsset.findMany({ where: { ownerType: "STORE", ownerStoreId: storeId }, orderBy: { createdAt: "desc" }, select: { id: true, publicReference: true, purpose: true, status: true, mimeType: true, byteSize: true, width: true, height: true, checksum: true, createdAt: true, productMedia: { select: { id: true } } } });
}

export async function listAdminCatalogMediaForPage() {
  return prisma.catalogMediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, publicReference: true, ownerType: true, ownerStore: { select: { name: true, slug: true } }, purpose: true, status: true, mimeType: true, byteSize: true, width: true, height: true, checksum: true, quarantineReasonCode: true, rejectionReasonCode: true, createdAt: true } });
}

export async function getAdminCatalogMediaForPage(id: string) {
  return prisma.catalogMediaAsset.findUnique({ where: { id }, select: { id: true, publicReference: true, ownerType: true, ownerStore: { select: { name: true, slug: true } }, purpose: true, status: true, declaredMimeType: true, mimeType: true, declaredByteSize: true, byteSize: true, width: true, height: true, checksum: true, privacyInspectionPassed: true, validationSummary: true, quarantineReasonCode: true, rejectionReasonCode: true, version: true, createdAt: true, updatedAt: true, history: { orderBy: { createdAt: "desc" }, select: { fromStatus: true, toStatus: true, action: true, reasonCode: true, safeDetails: true, actorUserId: true, createdAt: true } }, productMedia: { orderBy: [{ productId: "asc" }, { displayOrder: "asc" }], select: { id: true, role: true, altText: true, displayOrder: true, product: { select: { publicReference: true, title: true } }, variant: { select: { publicReference: true, title: true } } } } } });
}
