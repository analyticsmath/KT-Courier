import { CatalogPolicyError } from "@/lib/catalog/errors";

export const CATALOG_MEDIA_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type CatalogMediaMimeType = (typeof CATALOG_MEDIA_ALLOWED_MIME_TYPES)[number];

export const CATALOG_MEDIA_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const CATALOG_MEDIA_MIN_WIDTH = 300;
export const CATALOG_MEDIA_MIN_HEIGHT = 300;
export const CATALOG_MEDIA_MAX_WIDTH = 8_000;
export const CATALOG_MEDIA_MAX_HEIGHT = 8_000;
export const CATALOG_MEDIA_MAX_PIXELS = 25_000_000;
export const CATALOG_MEDIA_MIN_ASPECT_RATIO = 1 / 8;
export const CATALOG_MEDIA_MAX_ASPECT_RATIO = 8;
export const CATALOG_MEDIA_UPLOAD_TTL_MS = 15 * 60 * 1000;
export const CATALOG_MEDIA_MAX_PRODUCT_IMAGES = 12;
export const CATALOG_MEDIA_MAX_VARIANT_IMAGES = 6;

export const CATALOG_MEDIA_IMAGE_ROLES = ["PRIMARY", "GALLERY", "VARIANT", "SWATCH", "LABEL"] as const;
export type CatalogMediaImageRole = (typeof CATALOG_MEDIA_IMAGE_ROLES)[number];
export type CatalogMediaPurpose = "PRODUCT_IMAGE" | "VARIANT_IMAGE" | "CATEGORY_IMAGE" | "BRAND_LOGO" | "COMPLIANCE_DOCUMENT";

export function isCatalogMediaMimeType(value: string): value is CatalogMediaMimeType {
  return CATALOG_MEDIA_ALLOWED_MIME_TYPES.some((mimeType) => mimeType === value);
}

export function assertCatalogMediaDeclaration(input: {
  purpose: CatalogMediaPurpose;
  declaredMimeType: string;
  declaredByteSize: number;
}): asserts input is typeof input & { declaredMimeType: CatalogMediaMimeType } {
  if (input.purpose === "COMPLIANCE_DOCUMENT") {
    throw new CatalogPolicyError("CATALOG_MEDIA_PURPOSE_UNSUPPORTED", "Compliance-document upload is unavailable without a reviewed private document pipeline.");
  }
  if (!isCatalogMediaMimeType(input.declaredMimeType)) {
    throw new CatalogPolicyError("CATALOG_MEDIA_TYPE_UNSUPPORTED", "Only JPEG, PNG and WebP catalog images are accepted.", 415);
  }
  if (!Number.isSafeInteger(input.declaredByteSize) || input.declaredByteSize < 1 || input.declaredByteSize > CATALOG_MEDIA_MAX_UPLOAD_BYTES) {
    throw new CatalogPolicyError("CATALOG_MEDIA_SIZE_INVALID", "Catalog images must be between 1 byte and 8 MiB.", 413);
  }
}

export function assertCatalogMediaPurposeForOwner(ownerType: "PLATFORM" | "STORE", purpose: CatalogMediaPurpose): void {
  if (ownerType === "STORE" && !["PRODUCT_IMAGE", "VARIANT_IMAGE"].includes(purpose)) {
    throw new CatalogPolicyError("CATALOG_MEDIA_PURPOSE_FORBIDDEN", "Store media may be created only for store-authored product or variant imagery.", 403);
  }
  if (purpose === "COMPLIANCE_DOCUMENT") {
    throw new CatalogPolicyError("CATALOG_MEDIA_PURPOSE_UNSUPPORTED", "Compliance-document upload requires a reviewed private document pipeline.");
  }
}

export function assertCatalogMediaPurposeRole(purpose: CatalogMediaPurpose, role: CatalogMediaImageRole): void {
  const allowed = purpose === "PRODUCT_IMAGE" ? ["PRIMARY", "GALLERY", "LABEL"] : purpose === "VARIANT_IMAGE" ? ["VARIANT", "SWATCH"] : [];
  if (!allowed.includes(role)) throw new CatalogPolicyError("CATALOG_MEDIA_PURPOSE_ROLE_MISMATCH", "Uploaded media purpose is incompatible with the requested catalog role.");
}

export function assertCatalogMediaDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < CATALOG_MEDIA_MIN_WIDTH || height < CATALOG_MEDIA_MIN_HEIGHT) {
    throw new CatalogPolicyError("CATALOG_MEDIA_DIMENSIONS_TOO_SMALL", `Catalog images must be at least ${CATALOG_MEDIA_MIN_WIDTH} × ${CATALOG_MEDIA_MIN_HEIGHT} pixels.`);
  }
  if (width > CATALOG_MEDIA_MAX_WIDTH || height > CATALOG_MEDIA_MAX_HEIGHT || width * height > CATALOG_MEDIA_MAX_PIXELS) {
    throw new CatalogPolicyError("CATALOG_MEDIA_DIMENSIONS_TOO_LARGE", "Catalog image dimensions exceed the decompression-safety limit.");
  }
  const aspectRatio = width / height;
  if (aspectRatio < CATALOG_MEDIA_MIN_ASPECT_RATIO || aspectRatio > CATALOG_MEDIA_MAX_ASPECT_RATIO) {
    throw new CatalogPolicyError("CATALOG_MEDIA_ASPECT_RATIO_INVALID", "Catalog image aspect ratio is outside the supported range.");
  }
}

export function assertCatalogMediaRole(input: { role: string; variantId?: string | null }): asserts input is typeof input & { role: CatalogMediaImageRole } {
  if (!CATALOG_MEDIA_IMAGE_ROLES.some((role) => role === input.role)) {
    throw new CatalogPolicyError("CATALOG_MEDIA_ROLE_INVALID", "This media role is not available for consumer-facing catalog images.");
  }
  if (input.role === "VARIANT" && !input.variantId) {
    throw new CatalogPolicyError("CATALOG_MEDIA_VARIANT_REQUIRED", "Variant media must identify a variant on the same product.");
  }
}

export function assertCatalogMediaCounts(input: { productImageCount: number; variantImageCount: number; primaryImageCount: number }): void {
  if (input.productImageCount > CATALOG_MEDIA_MAX_PRODUCT_IMAGES) throw new CatalogPolicyError("CATALOG_MEDIA_PRODUCT_LIMIT", "A product may have at most 12 images.");
  if (input.variantImageCount > CATALOG_MEDIA_MAX_VARIANT_IMAGES) throw new CatalogPolicyError("CATALOG_MEDIA_VARIANT_LIMIT", "A variant may have at most 6 images.");
  if (input.primaryImageCount !== 1) throw new CatalogPolicyError("CATALOG_MEDIA_PRIMARY_REQUIRED", "A media set must contain exactly one product primary image.");
}
