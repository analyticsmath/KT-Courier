import Link from "next/link";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceCategoriesHref, marketplaceHref, marketplaceSearchHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";

export default function MarketplaceNotFound() {
  return (
    <main className={`${styles.page} ${styles.listing}`} id="storefront-content">
      <div className={styles.inner}>
        <section aria-labelledby="marketplace-not-found" className={styles.empty}>
          <p className={styles.eyebrow}>Marketplace record unavailable</p>
          <h1 id="marketplace-not-found">That marketplace record is not available.</h1>
          <p>It may no longer be published, or the marketplace link may be incomplete. No private record information is shown.</p>
          <div className={styles.appliedFilters}>
            <Link className={styles.textLink} href={marketplaceHref()}>Marketplace home</Link>
            <Link className={styles.textLink} href={marketplaceCategoriesHref()}>Categories</Link>
            <Link className={styles.textLink} href={marketplaceStoresHref()}>Stores</Link>
            <Link className={styles.textLink} href={marketplaceSearchHref()}>Search</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
