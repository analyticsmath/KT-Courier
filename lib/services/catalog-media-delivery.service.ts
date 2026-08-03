import { prisma } from "@/lib/db/prisma";
import { CatalogMediaDeliveryService, type CatalogMediaDeliveryRepository } from "@/lib/catalog/media/catalog-media-delivery";
import { createProductionCatalogMediaStorageAdapter } from "@/lib/catalog/media/catalog-media-storage-adapter";

export class PrismaCatalogMediaDeliveryRepository implements CatalogMediaDeliveryRepository {
  async findPublicEvidence(publicReference: string) {
    const asset = await prisma.catalogMediaAsset.findUnique({
      where: { publicReference },
      include: {
        productMedia: {
          where: { role: { not: "COMPLIANCE_DOCUMENT" } },
          take: 1,
          include: { product: { include: { publicationSnapshots: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 20 } } } },
        },
      },
    });
    const association = asset?.productMedia[0];
    const snapshot = association?.product.publicationSnapshots.find((candidate) => snapshotReferencesAsset(candidate.snapshot, publicReference));
    if (!asset || !association || !snapshot) return null;
    return { publicReference: asset.publicReference, storageKey: asset.storageKey, status: asset.status, mimeType: asset.mimeType, byteSize: asset.byteSize, checksum: asset.checksum, privacyInspectionPassed: asset.privacyInspectionPassed, associationRole: association.role, productPublicationStatus: association.product.publicationStatus, snapshotStatus: snapshot.status };
  }
}

function snapshotReferencesAsset(snapshot: unknown, publicReference: string): boolean {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  const media = (snapshot as { media?: unknown }).media;
  return Array.isArray(media) && media.some((item) => !!item && typeof item === "object" && !Array.isArray(item) && (item as { assetReference?: unknown }).assetReference === publicReference);
}

export function createProductionCatalogMediaDeliveryService() {
  return new CatalogMediaDeliveryService(new PrismaCatalogMediaDeliveryRepository(), createProductionCatalogMediaStorageAdapter());
}
