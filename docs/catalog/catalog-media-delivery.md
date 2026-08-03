# Catalog media delivery

Catalog DTOs use `CatalogMediaAsset.publicReference`, never `storageKey`. The controlled route is `/api/catalog/media/[publicReference]`.

Public delivery requires all of the following:

1. `CatalogMediaAsset.status = READY` with validated MIME, size, dimensions, checksum and privacy inspection.
2. A non-`COMPLIANCE_DOCUMENT` product-media association.
3. Product publication status `PUBLISHED`.
4. A `PUBLISHED` immutable `CatalogPublicationSnapshot` for that product.
5. The source-level production media approval lock to be open and a reviewed storage adapter to be active.

Before Phase 26.5, condition 5 is false, so public delivery returns a safe lock response without opening storage. When enabled after review, the application supplies exact content type, bounded content length, inline filename without the original local name, `nosniff`, a sandbox CSP and a five-minute cache policy. Path traversal and direct storage-key lookup are impossible because routes accept only public asset references.

Compliance-document roles remain private. Upload intents and their application content endpoints are never public read targets.
