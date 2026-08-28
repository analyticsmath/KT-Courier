import Link from "next/link";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplaceCategoriesHref,
  marketplaceHref,
  marketplaceSearchHref,
  marketplaceStoresHref,
} from "@/lib/public-marketplace/routes";

export default function MarketplaceNotFound() {
  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner} style={{ padding: "5rem 0" }}>
        <h1 style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 560, margin: "0 0 16px" }}>
          That marketplace item is not available.
        </h1>
        <p style={{ color: "var(--kt-muted, #5f6763)", fontSize: "1.05rem", maxWidth: 600, margin: "0 0 24px" }}>
          It may no longer be published or the link may have changed. Explore the marketplace using the links below.
        </p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <Link className={styles.sectionDirectLink} href={marketplaceHref()}>
            Marketplace Home
          </Link>
          <Link className={styles.sectionDirectLink} href={marketplaceCategoriesHref()}>
            Browse Categories
          </Link>
          <Link className={styles.sectionDirectLink} href={marketplaceStoresHref()}>
            Independent Stores
          </Link>
          <Link className={styles.sectionDirectLink} href={marketplaceSearchHref()}>
            Search Products
          </Link>
        </div>
      </div>
    </main>
  );
}
