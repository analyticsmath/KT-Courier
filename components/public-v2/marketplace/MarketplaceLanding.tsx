import Link from "next/link";
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

export function MarketplaceLanding({
  categories,
  stores,
  products,
}: {
  categories: readonly MarketplaceCategory[];
  stores: readonly MarketplaceStore[];
  products: readonly StorefrontProductCard[];
}) {
  return (
    <main className={styles.commerceRoot} id="storefront-content">
      {/* 1. Market Entry Field (First Viewport) */}
      <ShopEntryField categories={categories} />

      {/* 2. Category Discovery Field */}
      <CategoryDiscoveryField categories={categories} />

      {/* 3. Merchant Window */}
      <MerchantWindow stores={stores} />

      {/* 4. Live Marketplace Products */}
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
                ? `/shop/categories/${categories[0].path}`
                : marketplaceCategoriesHref()
            }
            editorialCategoryTitle={categories[0]?.name || "Local Food & Kitchens"}
            label="Marketplace live products"
            products={products}
            withEditorialInterruption={products.length >= 6}
          />
        </div>
      </section>
    </main>
  );
}
