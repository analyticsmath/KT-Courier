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
        categoryImages: {
          where: { status: "ACTIVE" },
          take: 1,
        },
        ownerStore: {
          select: { id: true, status: true, storefrontDocument: { select: { publicStatus: true, logoMediaReference: true, heroMediaReference: true } } },
        },
      },
    });

    if (!asset || asset.status !== "READY" || !asset.privacyInspectionPassed) return null;

    // 1. PRODUCT subject evidence
    const association = asset.productMedia[0];
    if (association) {
      const snapshot = association.product.publicationSnapshots.find((candidate) => snapshotReferencesAsset(candidate.snapshot, publicReference));
      if (snapshot && association.product.publicationStatus === "PUBLISHED" && snapshot.status === "PUBLISHED") {
        return {
          publicReference: asset.publicReference,
          storageKey: asset.storageKey,
          status: asset.status,
          mimeType: asset.mimeType,
          byteSize: asset.byteSize,
          checksum: asset.checksum,
          privacyInspectionPassed: asset.privacyInspectionPassed,
          associationRole: association.role,
          productPublicationStatus: association.product.publicationStatus,
          snapshotStatus: snapshot.status,
        };
      }
    }

    // 2. CATEGORY subject evidence
    if (asset.purpose === "CATEGORY_IMAGE" || asset.categoryImages.length > 0) {
      const category = asset.categoryImages[0] ?? (await prisma.catalogCategory.findFirst({ where: { imageAssetId: asset.id, status: "ACTIVE" } }));
      if (category) {
        return {
          publicReference: asset.publicReference,
          storageKey: asset.storageKey,
          status: asset.status,
          mimeType: asset.mimeType,
          byteSize: asset.byteSize,
          checksum: asset.checksum,
          privacyInspectionPassed: asset.privacyInspectionPassed,
          associationRole: "PRIMARY",
          productPublicationStatus: "PUBLISHED",
          snapshotStatus: "PUBLISHED",
        };
      }
    }

    // 3. STORE subject evidence (STORE_LOGO / STORE_HERO)
    if (asset.purpose === "STORE_LOGO" || asset.purpose === "STORE_HERO" || asset.purpose === "BRAND_LOGO") {
      const storeDoc = await prisma.storefrontStoreDocument.findFirst({
        where: {
          publicStatus: "ACTIVE",
          OR: [
            { logoMediaReference: publicReference },
            { heroMediaReference: publicReference },
            ...(asset.ownerStoreId ? [{ storeId: asset.ownerStoreId }] : []),
          ],
        },
      });

      if (storeDoc || (asset.ownerStore && asset.ownerStore.status === "ACTIVE")) {
        return {
          publicReference: asset.publicReference,
          storageKey: asset.storageKey,
          status: asset.status,
          mimeType: asset.mimeType,
          byteSize: asset.byteSize,
          checksum: asset.checksum,
          privacyInspectionPassed: asset.privacyInspectionPassed,
          associationRole: asset.purpose === "STORE_HERO" ? "GALLERY" : "PRIMARY",
          productPublicationStatus: "PUBLISHED",
          snapshotStatus: "PUBLISHED",
        };
      }
    }

    return null;
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
