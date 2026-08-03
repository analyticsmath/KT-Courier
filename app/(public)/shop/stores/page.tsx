import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceSearchForm, MarketplaceStoreGrid } from "@/components/public-v2/marketplace/MarketplaceCards";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceCategoriesHref, marketplaceHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { listStorefrontStores } from "@/lib/services/storefront-catalog.service";

export const metadata: Metadata = {
  title: "Local Marketplace Stores | KT Couriers",
  description: "Browse published local merchant stores connected to the KT Couriers marketplace.",
};

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const query = (await searchParams).q;
  const q = typeof query === "string" ? query.slice(0, 80) : "";
  const stores = await listStorefrontStores({ query: q || undefined, limit: 48 });

  return (
    <main className={`${styles.page} ${styles.listing}`} id="storefront-content">
      <div className={styles.inner}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href={marketplaceHref()}>Shop</Link> / <span aria-current="page">Stores</span></nav>
        <div className={styles.listingHeading}>
          <p className={styles.eyebrow}>Marketplace stores</p>
          <h1>Find a storefront.</h1>
          <p className={styles.listingDescription}>Explore published stores. Store schedules and delivery eligibility remain confirmed through their canonical marketplace flow.</p>
          <MarketplaceSearchForm action={marketplaceStoresHref()} query={q} />
        </div>
        <div className={styles.resultBar}><p>{stores.length} {stores.length === 1 ? "store" : "stores"} shown</p><Link className={styles.textLink} href={marketplaceCategoriesHref()}>Browse categories</Link></div>
        {stores.length ? <MarketplaceStoreGrid label="Marketplace stores" stores={stores} /> : <section className={styles.empty} aria-labelledby="stores-empty"><h2 id="stores-empty">No matching stores</h2><p>Try a different store search or browse the marketplace categories.</p><Link className={styles.textLink} href={marketplaceStoresHref()}>Clear search</Link></section>}
      </div>
    </main>
  );
}
