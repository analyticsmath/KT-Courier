import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { marketplaceHref, marketplaceSearchHref } from "@/lib/public-marketplace/routes";

export const metadata: Metadata = {
  title: "Curated Collections | KT Couriers Marketplace",
  description: "Browse active curated marketplace collections where they are published.",
};

export default function CollectionsPage() {
  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner}>
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: "0.85rem",
            color: "var(--kt-muted, #5f6763)",
            padding: "1.5rem 0 1rem",
          }}
        >
          <Link href={marketplaceHref()} style={{ color: "inherit", textDecoration: "none" }}>
            Shop
          </Link>{" "}
          / <span aria-current="page" style={{ color: "var(--kt-carbon, #101210)", fontWeight: 600 }}>Collections</span>
        </nav>

        <div style={{ padding: "3rem 0 5rem" }}>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 560, letterSpacing: "-0.035em", margin: "0 0 12px" }}>
            Curated Collections
          </h1>
          <p style={{ color: "var(--kt-muted, #5f6763)", fontSize: "1.05rem", maxWidth: 600, margin: "0 0 24px" }}>
            Collections are published directly with specialized product curation and regional merchant spotlights.
          </p>
          <Link className={styles.sectionDirectLink} href={marketplaceSearchHref()}>
            Search all products &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
