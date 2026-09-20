import Link from "next/link";
import Image from "next/image";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import {
  ShopEntryField,
  CategoryDiscoveryField,
  MerchantWindow,
  ProductGrid,
} from "@/components/public-v2/commerce";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplaceCategoriesHref,
  marketplaceCategoryHref,
  marketplaceSearchHref,
} from "@/lib/public-marketplace/routes";

export type MarketplaceCategory = {
  reference: string;
  path: string;
  name: string;
  description?: string;
  imageReference?: string;
  productCount?: number;
};

export type MarketplaceStore = {
  reference: string;
  slug: string;
  name: string;
  description?: string;
  logoMediaReference?: string;
  heroMediaReference?: string;
  publishedOfferCount: number;
};

export type MarketplaceCollection = {
  reference: string;
  slug: string;
  name: string;
  description?: string;
  itemCount: number;
  coverMediaReference?: string;
};

export function MarketplaceLanding({
  categories,
  stores,
  products,
  collections = [],
}: {
  categories: readonly MarketplaceCategory[];
  stores: readonly MarketplaceStore[];
  products: readonly StorefrontProductCard[];
  collections?: readonly MarketplaceCollection[];
}) {
  return (
    <main className={styles.commerceRoot} id="storefront-content">
      {/* 1. Market Entry Field (First Viewport) */}
      <ShopEntryField categories={categories} />

      {/* 2. Category Discovery Field */}
      <CategoryDiscoveryField categories={categories} />

      {/* 3. Live Marketplace Products */}
      <section aria-labelledby="live-products-title" className={styles.productGridSection}>
        <div className={styles.commerceInner}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <h2 className={styles.sectionTitleMain} id="live-products-title">
                New in the Market
              </h2>
            </div>
            <Link className={styles.sectionDirectLink} href={marketplaceSearchHref()}>
              Search all items &rarr;
            </Link>
          </div>

          <ProductGrid
            editorialCategoryHref={
              categories[0]
                ? marketplaceCategoryHref(categories[0].path) ?? marketplaceCategoriesHref()
                : marketplaceCategoriesHref()
            }
            editorialCategoryTitle={categories[0]?.name || "Local Food & Kitchens"}
            label="Marketplace live products"
            products={products}
            withEditorialInterruption={products.length >= 6}
          />
        </div>
      </section>

      {/* 4. Independent local stores */}
      <MerchantWindow stores={stores} />

      {/* 5. Active editorial collections */}
      {collections.length > 0 && <section aria-labelledby="home-collections-title" className={styles.commerceSection}>
        <div className={styles.commerceInner}>
          <div className={styles.commerceSectionHeader}>
            <div><p className={styles.productTileBrand}>Curated edits</p><h2 id="home-collections-title">Collections</h2></div>
            <Link className={styles.sectionDirectLink} href="/shop/collections">All collections &rarr;</Link>
          </div>
          <ul className={styles.collectionGrid}>
            {collections.slice(0, 3).map((collection, index) => {
              const href = `/shop/collections/${encodeURIComponent(collection.slug)}`;
              return <li key={collection.reference}><Link className={styles.collectionCard} href={href}>
                {collection.coverMediaReference && <span className={styles.collectionCardImage}><Image alt="" fill priority={index === 0} sizes="(max-width: 767px) 100vw, 40vw" src={`/api/catalog/media/${collection.coverMediaReference}`} style={{ objectFit: "cover" }} /></span>}
                <span className={styles.collectionCardCopy}><h2>{collection.name}</h2>{collection.description && <p>{collection.description}</p>}</span>
              </Link></li>;
            })}
          </ul>
        </div>
      </section>}
    </main>
  );
}
