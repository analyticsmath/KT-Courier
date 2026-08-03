import { CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";

export type CatalogMediaOwner = Readonly<{
  ownerType: "PLATFORM" | "STORE";
  ownerStoreId: string | null;
}>;

export function assertCatalogMediaOwnerShape(owner: CatalogMediaOwner): void {
  if (owner.ownerType === "PLATFORM" && owner.ownerStoreId !== null) throw new CatalogPolicyError("CATALOG_MEDIA_PLATFORM_OWNER_INVALID", "Platform media cannot carry store ownership.");
  if (owner.ownerType === "STORE" && !owner.ownerStoreId) throw new CatalogPolicyError("CATALOG_MEDIA_STORE_OWNER_REQUIRED", "Store media requires an owning store.");
}

export function assertStoreCanAccessCatalogMedia(owner: CatalogMediaOwner, authenticatedStoreId: string): void {
  assertCatalogMediaOwnerShape(owner);
  if (owner.ownerType !== "STORE" || owner.ownerStoreId !== authenticatedStoreId) throw new CatalogOwnershipError();
}

export function assertCatalogMediaOwnershipImmutable(before: CatalogMediaOwner, after: CatalogMediaOwner, input: { ready: boolean; attached: boolean }): void {
  if ((input.ready || input.attached) && (before.ownerType !== after.ownerType || before.ownerStoreId !== after.ownerStoreId)) {
    throw new CatalogPolicyError("CATALOG_MEDIA_OWNER_IMMUTABLE", "Ready or attached catalog media cannot change owner.", 409);
  }
}
