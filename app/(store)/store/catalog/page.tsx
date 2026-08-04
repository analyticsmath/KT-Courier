import Link from "next/link";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation, StorefrontAvailability } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage, getStoreCatalogPageSummary } from "@/lib/services/catalog-page.service";

export default async function StoreCatalogPage() {
  const { store } = await getCurrentStoreForCatalogPage();
  const summary = await getStoreCatalogPageSummary(store.id);
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog" title="Product Catalog" description="Manage store-owned product identities, offers, prices, and movement-backed inventory. Storefront publication remains separate." actions={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white" href="/store/catalog/products/new">Add product</Link>} />
    <StoreCatalogNavigation />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Catalog summary"><MetricTile label="Products" value={summary.products} description="Canonical store product records" /><MetricTile label="Offers" value={summary.offers} description="Store variant offers" /><MetricTile label="Open imports" value={summary.imports} description="In-progress catalog import jobs" /><MetricTile label="Needs review" value={summary.moderation} description="Open catalog moderation records" /></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]"><OperationalPanel title="Catalog workspace" description="Product identity, offers, price versions, and inventory are distinct records with their own validation authority." padding="compact"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-[var(--eo-text-muted)]">Inventory locations</dt><dd className="mt-1 font-semibold text-[var(--eo-text)]">{summary.locations}</dd></div><div><dt className="font-semibold text-[var(--eo-text-muted)]">Next action</dt><dd className="mt-1 text-[var(--eo-text-secondary)]">Create or review a canonical product record.</dd></div></dl></OperationalPanel><StorefrontAvailability /></div>
  </ProtectedPageFrame>;
}
