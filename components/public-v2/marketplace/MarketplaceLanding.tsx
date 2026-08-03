import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { marketplaceCategoriesHref, marketplaceSearchHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { MarketplaceCategoryRail, MarketplaceProductGrid, MarketplaceSearchForm, MarketplaceStoreGrid, type MarketplaceCategory, type MarketplaceStore } from "./MarketplaceCards";
import styles from "./market-hall.module.css";

export function MarketplaceLanding({ categories, stores, products }: { categories: readonly MarketplaceCategory[]; stores: readonly MarketplaceStore[]; products: readonly StorefrontProductCard[] }) {
  return (
    <main className={styles.page} id="storefront-content">
      <section className={styles.masthead}>
        <div className={`${styles.inner} ${styles.mastheadGrid}`}>
          <div>
            <p className={styles.eyebrow}>KT Couriers marketplace</p>
            <h1>Local goods, thoughtfully routed.</h1>
            <p className={styles.lead}>Discover published products and independent stores connected to the KT Couriers delivery network.</p>
            <MarketplaceSearchForm />
          </div>
          <aside className={styles.mastheadVisual} aria-label="Marketplace statement"><p className={styles.eyebrow}>The market hall</p><strong>Browse with clarity. <span>Confirm at checkout.</span></strong></aside>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="market-categories">
        <div className={styles.inner}>
          <div className={styles.sectionHeader}><div className={styles.sectionHeading}><p className={styles.sectionKicker}>Start with a category</p><h2 id="market-categories">Find your way in.</h2></div><Link className={styles.textLink} href={marketplaceCategoriesHref()}>All categories</Link></div>
          <MarketplaceCategoryRail categories={categories} />
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionMuted}`} aria-labelledby="market-stores">
        <div className={styles.inner}>
          <div className={styles.sectionHeader}><div className={styles.sectionHeading}><p className={styles.sectionKicker}>Store discovery</p><h2 id="market-stores">Meet the storefronts.</h2></div><Link className={styles.textLink} href={marketplaceStoresHref()}>Browse stores</Link></div>
          {stores.length ? <MarketplaceStoreGrid label="Marketplace stores" stores={stores} /> : <p className={styles.intro}>Stores will appear here once published records are available.</p>}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="market-products">
        <div className={styles.inner}>
          <div className={styles.sectionHeader}><div className={styles.sectionHeading}><p className={styles.sectionKicker}>Published catalog</p><h2 id="market-products">What stores have listed.</h2></div><Link className={styles.textLink} href={marketplaceSearchHref()}>Search products</Link></div>
          {products.length ? <MarketplaceProductGrid label="Published marketplace products" products={products} /> : <p className={styles.intro}>Published products will appear here when the catalog is available.</p>}
        </div>
      </section>

      <section className={`${styles.section} ${styles.deliverySection}`} aria-labelledby="market-delivery">
        <div className={`${styles.inner} ${styles.deliveryGrid}`}><div className={styles.deliveryCopy}><h2 id="market-delivery">Delivery stays deliberate.</h2><p>Availability is shown for browsing. The canonical checkout flow confirms the current store, product, and delivery details before an order can proceed.</p></div><Link className={styles.textLink} href="/account/request-delivery">Request a courier delivery</Link></div>
      </section>
    </main>
  );
}
