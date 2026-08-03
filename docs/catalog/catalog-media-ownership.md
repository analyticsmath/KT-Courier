# Catalog media ownership

Every `CatalogMediaAsset` and `CatalogMediaUploadIntent` has an explicit `CatalogMediaOwnerType`.

- `PLATFORM` requires `ownerStoreId = NULL`. It is used by global canonical products, platform categories, brands and reviewed platform content.

- `STORE` requires an existing `ownerStoreId`. Store APIs derive this value from the authenticated active owned Store and never accept it in request bodies.

Store users may list, inspect, archive and attach only assets belonging to their exact store. Platform assets are read-only to store users. Equal checksums do not grant access or merge authorization records.

Global canonical products accept only READY platform assets. Store-private products accept only READY assets from their source store. Variant media must point to a variant on the same product. Categories and brands accept only READY platform media. Database triggers repeat these checks.

Owner scope is immutable once an asset is READY or attached. There is no implicit ownership promotion. A future store-to-platform copy must create a distinct platform authorization record through an explicitly reviewed operation; this correction does not expose such an operation.
