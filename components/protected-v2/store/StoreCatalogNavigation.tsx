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
      title="Storefront publication is live"
      description="Published catalog offers are projected to the public KT Courier marketplace. Draft or review-state records remain private until they are published."
      padding="compact"
      action={<Link className="text-sm font-semibold underline underline-offset-4" href="/shop">View live marketplace</Link>}
    >
      <p className="text-sm text-[var(--eo-text-secondary)]">
        Manage product identity, pricing, inventory, media, and offers here. Published records can be browsed and purchased from the live storefront.
      </p>
    </OperationalPanel>
  );
}
