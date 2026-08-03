import Link from "next/link";
import { MarketplaceCategoryRail, MarketplaceProductGrid, MarketplaceStoreGrid } from "@/components/public-v2/marketplace/MarketplaceCards";
import { marketplaceHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import styles from "./homepage-v2.module.css";

export async function MarketplacePreview() {
  let home: Awaited<ReturnType<typeof getStorefrontHome>> | null = null;
  try {
    home = await getStorefrontHome();
  } catch {
    // The rest of the public home page remains useful while the canonical
    // marketplace projection is temporarily unavailable.
    home = null;
  }

  if (home) {
    return (
      <section aria-labelledby="marketplace-heading" className={styles.marketplaceSection}>
        <div className={styles.sectionInner}>
          <div className={styles.marketplaceHeading}>
            <div>
              <p className={styles.sectionMarker}>Marketplace selection</p>
              <h2 id="marketplace-heading">A closer look at the market.</h2>
            </div>
            <p>Published records are selected deterministically: category path, store name, and the catalog&apos;s canonical newest-first order.</p>
          </div>
          <MarketplaceCategoryRail categories={home.categories.slice(0, 4)} label="Marketplace categories" />
          {home.stores.length ? <MarketplaceStoreGrid label="Marketplace stores" stores={home.stores.slice(0, 3)} /> : null}
          {home.newArrivals.length ? <MarketplaceProductGrid label="Published marketplace products" products={home.newArrivals.slice(0, 4)} /> : null}
          <div className={styles.marketplaceFooter}><div className={styles.textActions}><Link className={styles.textActionPrimary} href={marketplaceHref()}>Shop the marketplace</Link><Link className={styles.textAction} href={marketplaceStoresHref()}>Browse stores <span aria-hidden="true">→</span></Link></div></div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="marketplace-heading" className={styles.marketplaceSection}>
      <div className={styles.sectionInner}>
        <div className={styles.marketplaceHeading}>
          <div>
            <p className={styles.sectionMarker}>Marketplace source unavailable</p>
            <h2 id="marketplace-heading">Marketplace records cannot load right now.</h2>
          </div>
          <p>No store, product, price, or availability record is substituted while the canonical marketplace source is unavailable.</p>
        </div>

        <div className={styles.marketplaceFooter}>
          <div className={styles.textActions}>
            <Link className={styles.textActionPrimary} href={marketplaceHref()}>Open the marketplace</Link>
            <Link className={styles.textAction} href="/signup?type=store">Join as a store <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
