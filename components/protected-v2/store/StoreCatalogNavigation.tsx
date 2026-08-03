import Link from "next/link";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { AccessBoundaryIllustration } from "@/components/protected-v2/illustrations/AccessBoundaryIllustration";
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
  return <div className={styles.scope}><ProtectedState kind="locked" title="Storefront publication is not available" description="Catalog drafting and review remain separate from public storefront publication. This page does not imply that products, prices, offers, or checkout are live." illustration={<AccessBoundaryIllustration className="h-20 w-28" />} /></div>;
}
