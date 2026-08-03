"use client";

import Link from "next/link";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={`${styles.page} ${styles.listing}`} id="storefront-content">
      <div className={styles.inner}>
        <section className={styles.empty} aria-labelledby="shop-source-unavailable">
          <p className={styles.eyebrow}>Marketplace source unavailable</p>
          <h1 id="shop-source-unavailable">The shop cannot load right now.</h1>
          <p>No store, product, price, or availability information is shown until the canonical marketplace source responds again.</p>
          <div className={styles.appliedFilters}><button className={styles.primaryLink} onClick={reset} type="button">Try again</button><Link className={styles.textLink} href="/">Return home</Link></div>
        </section>
      </div>
    </main>
  );
}
