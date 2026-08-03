import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceHref, marketplaceSearchHref } from "@/lib/public-marketplace/routes";

export const metadata: Metadata = {
  title: "Marketplace Collections | KT Couriers",
  description: "Browse active curated marketplace collections where they are published.",
};

/** There is no directory authority for collections; individual collection URLs remain the canonical entry. */
export default function CollectionsPage() {
  return <main className={`${styles.page} ${styles.listing}`} id="storefront-content"><div className={styles.inner}><nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href={marketplaceHref()}>Shop</Link> / <span aria-current="page">Collections</span></nav><section className={styles.empty} aria-labelledby="collection-directory"><h1 id="collection-directory">Marketplace collections</h1><p>Collections are available only through their published canonical links. Browse categories or search the marketplace to continue.</p><Link className={styles.textLink} href={marketplaceSearchHref()}>Search products</Link></section></div></main>;
}
