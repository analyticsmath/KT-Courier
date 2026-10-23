import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { CatalogNotFoundError, CatalogPolicyError } from "@/lib/catalog/errors";
import { inspectCatalogMediaContent } from "@/lib/catalog/media/catalog-media-content-validation";
import { CATALOG_MEDIA_MAX_UPLOAD_BYTES, isCatalogMediaMimeType } from "@/lib/catalog/media/catalog-media-policy";
import { createProductionCatalogMediaStorageAdapter } from "@/lib/catalog/media/catalog-media-storage-adapter";
import { CLOUDINARY_CATALOG_STORAGE_CODE, createCloudinaryCatalogWriteAdapter } from "@/lib/catalog/media/cloudinary-catalog-media-storage";

/** Private review reads original validated bytes, independently of public publication. */
export async function readCatalogMediaForReview(id: string, download = false) {
  return readValidatedCatalogMedia({ id }, ["READY", "QUARANTINED"], download);
}

/** Store previews never expose another owner's or quarantined image. */
export async function readCatalogMediaForStore(publicReference: string, storeId: string, download = false) {
  return readValidatedCatalogMedia({ publicReference, ownerType: "STORE", ownerStoreId: storeId }, ["READY"], download);
}

async function readValidatedCatalogMedia(where: Prisma.CatalogMediaAssetWhereUniqueInput, allowedStatuses: string[], download: boolean) {
  const asset = await prisma.catalogMediaAsset.findUnique({ where, select: {
    status: true, purpose: true, mimeType: true, byteSize: true, checksum: true,
    privacyInspectionPassed: true, storageKey: true, storageProvider: true,
  } });
  if (!asset) throw new CatalogNotFoundError("Catalog image was not found.");
  if (!allowedStatuses.includes(asset.status) || asset.purpose === "COMPLIANCE_DOCUMENT"
    || !asset.mimeType || !isCatalogMediaMimeType(asset.mimeType) || !asset.privacyInspectionPassed
    || !asset.byteSize || asset.byteSize > CATALOG_MEDIA_MAX_UPLOAD_BYTES || !asset.checksum) {
    throw new CatalogPolicyError("CATALOG_MEDIA_REVIEW_CONTENT_UNAVAILABLE", "This image has no safe validated content available for inspection.", 409);
  }
  const storage = asset.storageProvider === CLOUDINARY_CATALOG_STORAGE_CODE
    ? createCloudinaryCatalogWriteAdapter()
    : createProductionCatalogMediaStorageAdapter();
  const target = await storage.createReadTarget({ storageKey: asset.storageKey, maximumBytes: asset.byteSize });
  if (target.byteSize !== asset.byteSize || target.body.byteLength !== asset.byteSize
    || createHash("sha256").update(target.body).digest("hex") !== asset.checksum) {
    throw new CatalogPolicyError("CATALOG_MEDIA_REVIEW_CONTENT_CHANGED", "Stored image no longer matches its validated evidence.", 409);
  }
  // Reuse intake's MIME, metadata, dimensions, and script/polyglot checks.
  inspectCatalogMediaContent({ bytes: target.body, declaredMimeType: asset.mimeType, declaredByteSize: asset.byteSize });
  const extension = asset.mimeType === "image/jpeg" ? "jpg" : asset.mimeType === "image/png" ? "png" : "webp";
  return { body: target.body, headers: {
    "Content-Type": asset.mimeType,
    "Content-Length": String(asset.byteSize),
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="catalog-review.${extension}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } };
}
