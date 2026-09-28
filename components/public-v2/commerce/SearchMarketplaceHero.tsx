import { CommerceBreadcrumbs } from "./CommerceBreadcrumbs";
import { CommerceSearchCommand } from "./CommerceSearchCommand";
import styles from "./commerce.module.css";

export function SearchMarketplaceHero({ query }: { query: string }) {
  return <section className={styles.searchMarketplaceHero} aria-labelledby="search-marketplace-title">
    <div className={styles.searchMarketplaceHeroContent}>
      <CommerceBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Search" }]} />
      <div className={styles.searchMarketplaceHeroCopy}>
        <h1 id="search-marketplace-title">Search the Marketplace</h1>
        <p>Find products from independent local storefronts.</p>
      </div>
      <div className={styles.searchMarketplaceHeroField}>
        <CommerceSearchCommand appearance="hero" query={query} placeholder="Search products, stores or categories..." />
      </div>
    </div>
  </section>;
}
