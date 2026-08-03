# R23 — Marketplace route-link audit

| Source page | Source component | Record type | Generated href | Destination route / parameter | Resolution status |
| --- | --- | --- | --- | --- | --- |
| `/shop` | `MarketplaceCategoryRail` | Published category projection | `marketplaceCategoryHref(category.path)` | `/shop/categories/[...categoryPath]` / `categoryPath` | Resolvable: canonical path is validated before `getStorefrontCategory()`. |
| `/shop`, homepage preview, search discovery | `MarketplaceStoreGrid` | Active public store | `marketplaceStoreHref(store.slug)` | `/shop/stores/[storeSlug]` / `storeSlug` | Resolvable: safe source slug is validated before `getStorefrontStore()`. |
| `/shop`, category/store listings, homepage preview, search | `MarketplaceProductGrid` | Active public product card | `marketplaceProductHref(product.productSlug, product.productReference)` | `/shop/products/[product]` / `slug-CP-*` | Resolvable: parser validates both values and the loader verifies its returned slug. |
| Product detail | Variant link list | Public variant | `marketplaceVariantHref(...)` | `/shop/products/[product]/[variantReference]` | Resolvable: public product and variant references are validated. |
| Product and variant detail | `MarketplaceOfferList` | Public offer store | `marketplaceStoreHref(offer.storeSlug)` | `/shop/stores/[storeSlug]` / `storeSlug` | Resolvable: active public store loader determines final visibility. |
| Category detail | `MarketplaceCategoryRail` | Public child category | `marketplaceCategoryHref(child.path)` | `/shop/categories/[...categoryPath]` / `categoryPath` | Resolvable: child navigation originates in the category projection. |
| Storefront detail | `MarketplaceCategoryRail` | Store-supplied public category | `marketplaceCategoryHref(category.path)` | `/shop/categories/[...categoryPath]` / `categoryPath` | Resolvable: category references are re-resolved through the public directory. |
| Search | `MarketplaceSearchDiscovery` | Server-suggested category/store | Shared category/store builders | Corresponding detail route | Resolvable: suggestion values are re-resolved by public loaders before rendering. |
| Search/category/store filters and pagination | `MarketplaceResults` | Listing state | `marketplaceListingHref(route, filters)` | Search/category/store route plus validated URL query | Resolvable: discriminated internal route and canonical filter parser only. |
| Collection detail | Collection-item mapping | Active public target | Product/variant/category/store builder | Corresponding canonical detail route | Resolvable: inactive/missing targets are omitted by the collection loader. |
| Shop sitemap | `app/(public)/shop/sitemap.ts` | Public projection record | Shared builders | Corresponding mounted dynamic page | Resolvable: malformed source fields are omitted; sitemap and page share route shapes. |

There are deliberately no product-to-cart record links in this audit. The public product projection does not expose a safe canonical cart action/display contract, and the existing cart and checkout boundary remains locked.
