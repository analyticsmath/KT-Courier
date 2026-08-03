import { CatalogPolicyError } from "@/lib/catalog/errors";

export type CatalogMediaAssetLifecycleStatus = "PENDING_UPLOAD" | "UPLOADED" | "VALIDATING" | "READY" | "QUARANTINED" | "REJECTED" | "ARCHIVED";
export type CatalogMediaUploadLifecycleStatus = "PENDING_UPLOAD" | "UPLOADED" | "COMPLETED" | "EXPIRED" | "CANCELLED";

const ASSET_TRANSITIONS: Readonly<Record<CatalogMediaAssetLifecycleStatus, readonly CatalogMediaAssetLifecycleStatus[]>> = {
  PENDING_UPLOAD: ["UPLOADED", "REJECTED", "ARCHIVED"],
  UPLOADED: ["VALIDATING", "QUARANTINED", "REJECTED", "ARCHIVED"],
  VALIDATING: ["READY", "QUARANTINED", "REJECTED"],
  READY: ["QUARANTINED", "ARCHIVED"],
  QUARANTINED: ["READY", "REJECTED", "ARCHIVED"],
  REJECTED: ["ARCHIVED"],
  ARCHIVED: [],
};

const INTENT_TRANSITIONS: Readonly<Record<CatalogMediaUploadLifecycleStatus, readonly CatalogMediaUploadLifecycleStatus[]>> = {
  PENDING_UPLOAD: ["UPLOADED", "EXPIRED", "CANCELLED"],
  UPLOADED: ["COMPLETED", "EXPIRED", "CANCELLED"],
  COMPLETED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function assertCatalogMediaAssetTransition(from: CatalogMediaAssetLifecycleStatus, to: CatalogMediaAssetLifecycleStatus): void {
  if (!ASSET_TRANSITIONS[from].includes(to)) throw new CatalogPolicyError("CATALOG_MEDIA_STATE_CONFLICT", `Catalog media cannot move from ${from} to ${to}.`, 409);
}

export function assertCatalogMediaUploadTransition(from: CatalogMediaUploadLifecycleStatus, to: CatalogMediaUploadLifecycleStatus): void {
  if (!INTENT_TRANSITIONS[from].includes(to)) throw new CatalogPolicyError("CATALOG_MEDIA_UPLOAD_STATE_CONFLICT", `Catalog upload cannot move from ${from} to ${to}.`, 409);
}
