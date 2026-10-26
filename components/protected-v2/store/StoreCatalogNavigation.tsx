import Link from "next/link";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import styles from "./store-pages.module.css";

const destinations = [
  ["Overview", "/store/catalog"],
  ["Products", "/store/catalog/products"],
  ["Offers", "/store/catalog/offers"],
  ["Media", "/store/catalog/media"],
  ["Inventory", "/store/catalog/inventory"],
  ["Modifiers", "/store/catalog/modifiers"],
  ["Imports", "/store/catalog/imports"],
] as const;

export function StoreCatalogNavigation() {
  return <nav aria-label="Store catalog" className={`${styles.scope} ${styles.catalogNavigation}`}>{destinations.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>;
}

export function StorefrontAvailability() {
  return (
    <OperationalPanel
      className={styles.storefrontAvailability}
      title="From draft to marketplace"
      description="Drafts stay private. Products and offers appear in the marketplace only after review and publication."
      padding="compact"
      action={<Link className="whitespace-nowrap text-sm font-semibold underline underline-offset-4" href="/shop">View live marketplace</Link>}
    >
      <p className="text-sm text-[var(--eo-text-secondary)]">
        Prepare your photos, prices and stock here. Customer purchases also require approved store checkout setup and delivery packaging.
      </p>
    </OperationalPanel>
  );
}
