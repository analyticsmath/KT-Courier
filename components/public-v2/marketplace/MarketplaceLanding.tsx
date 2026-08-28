import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import {
  marketplaceCategoriesHref,
  marketplaceSearchHref,
  marketplaceStoresHref,
} from "@/lib/public-marketplace/routes";
import {
  MarketplaceCategoryRail,
  MarketplaceProductGrid,
  MarketplaceSearchForm,
  MarketplaceStoreGrid,
  type MarketplaceCategory,
  type MarketplaceStore,
} from "./MarketplaceCards";
import styles from "./market-hall.module.css";

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
    <main className={styles.page} id="storefront-content">
      {/* Editorial Header */}
      <section className={styles.masthead}>
        <div className={styles.inner}>
          <div className={styles.mastheadHero}>
            <h1 className={styles.mastheadTitle}>Local goods, thoughtfully routed.</h1>
            <p className={styles.lead}>
              Discover independent storefronts, neighborhood creators, and local merchants connected directly with courier delivery.
            </p>
            <MarketplaceSearchForm />
          </div>
        </div>
      </section>

      {/* Category Discovery */}
      <section aria-labelledby="market-categories" className={styles.section}>
        <div className={styles.inner}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="market-categories">
                Browse by Category
              </h2>
            </div>
            <Link className={styles.textLink} href={marketplaceCategoriesHref()}>
              All categories &rarr;
            </Link>
          </div>
          <MarketplaceCategoryRail categories={categories} />
        </div>
      </section>

      {/* Store Discovery */}
      <section
        aria-labelledby="market-stores"
        className={`${styles.section} ${styles.sectionMuted}`}
      >
        <div className={styles.inner}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="market-stores">
                Independent Storefronts
              </h2>
            </div>
            <Link className={styles.textLink} href={marketplaceStoresHref()}>
              Browse stores &rarr;
            </Link>
          </div>
          {stores.length ? (
            <MarketplaceStoreGrid label="Marketplace stores" stores={stores} />
          ) : (
            <p className={styles.intro}>
              Stores will appear here once published records are active.
            </p>
          )}
        </div>
      </section>

      {/* Published Products */}
      <section aria-labelledby="market-products" className={styles.section}>
        <div className={styles.inner}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="market-products">
                Published Catalog
              </h2>
            </div>
            <Link className={styles.textLink} href={marketplaceSearchHref()}>
              Search all products &rarr;
            </Link>
          </div>
          {products.length ? (
            <MarketplaceProductGrid
              label="Published marketplace products"
              products={products}
            />
          ) : (
            <p className={styles.intro}>
              Published products will appear here when items are listed.
            </p>
          )}
        </div>
      </section>

      {/* Delivery Confirmation Note */}
      <section
        aria-labelledby="market-delivery"
        className={`${styles.section} ${styles.deliverySection}`}
      >
        <div className={`${styles.inner} ${styles.deliveryGrid}`}>
          <div className={styles.deliveryCopy}>
            <h2 className={styles.sectionTitle} id="market-delivery">
              Delivery Stays Deliberate
            </h2>
            <p>
              Browsing is open across all listed products. The checkout flow confirms current store availability, item variants, and delivery coordinates before an order is placed.
            </p>
          </div>
          <Link className={styles.textLink} href="/account/request-delivery">
            Request courier delivery &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}
