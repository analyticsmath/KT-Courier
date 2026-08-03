# Catalog domain model

The catalog uses five separate identities:

1. `CatalogProduct` describes common facts.
2. `CatalogProductVariant` describes an exact configuration.
3. `StoreCatalogOffer` says one store offers one variant.
4. `StoreOfferPriceVersion` records exact commercial terms for a period.
5. `CatalogInventoryItem` and location levels record availability projections backed by movements.

`GLOBAL_CANONICAL` products are platform-controlled and reusable. `STORE_PRIVATE` products require a source store and cannot be attached cross-store. A default variant represents products without meaningful options. Public references are stable; numeric `version` fields support optimistic concurrency. No used evidence has a DELETE route.

Legacy `Product`, `ProductCategory`, `ProductImage`, `InventoryItem`, and `InventoryMovement` remain isolated compatibility placeholders. They do not feed snapshots.

