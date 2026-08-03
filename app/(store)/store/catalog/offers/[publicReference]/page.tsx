import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation, StorefrontAvailability } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { getStoreCatalogOffer } from "@/lib/services/store-offer.service";

export default async function StoreOfferDetailPage({ params }: { params: Promise<{ publicReference: string }> }) {
  const { store } = await getCurrentStoreForCatalogPage();
  const { publicReference } = await params;
  const offer = await getStoreCatalogOffer(store.id, publicReference);
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Catalog", href: "/store/catalog" }, { label: "Offers", href: "/store/catalog/offers" }, { label: offer.storeSku }]} title={offer.storeSku} description={`${offer.product.title} · ${offer.variant.title}`} actions={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-3 text-sm font-semibold" href="/store/catalog/offers">Back to offers</Link>} />
    <StoreCatalogNavigation />
    <div className="grid gap-5 lg:grid-cols-2"><OperationalPanel title="Offer record" padding="compact"><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-[var(--eo-text-muted)]">Offer state</dt><dd className="mt-1"><ProtectedStatus label={offer.status.replaceAll("_", " ")} /></dd></div><div><dt className="font-semibold text-[var(--eo-text-muted)]">Publication state</dt><dd className="mt-1"><ProtectedStatus label={offer.publicationStatus.replaceAll("_", " ")} /></dd></div><div><dt className="font-semibold text-[var(--eo-text-muted)]">Fulfilment</dt><dd className="mt-1">{offer.fulfilmentMode.replaceAll("_", " ")}</dd></div><div><dt className="font-semibold text-[var(--eo-text-muted)]">Minimum quantity</dt><dd className="mt-1">{offer.minimumQuantity.toString()}</dd></div></dl></OperationalPanel><OperationalPanel title="Price records" description="Amounts are versioned server records; no total is calculated here." padding="compact">{offer.priceVersions.length ? <ul className="space-y-3">{offer.priceVersions.map((price) => <li className="rounded-[var(--eo-radius-control)] border border-[var(--eo-line-soft)] p-3 text-sm" key={price.id}><p className="font-semibold tabular-nums">ZAR {price.amount.toFixed(2)}</p><p className="mt-1 text-xs text-[var(--eo-text-muted)]">{price.status.replaceAll("_", " ")} · effective {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(price.effectiveFrom)}</p></li>)}</ul> : <p className="text-sm text-[var(--eo-text-secondary)]" role="status">No price version exists.</p>}</OperationalPanel></div>
    <OperationalPanel title="Inventory evidence" padding="compact">{offer.inventoryItem ? <EditorialTable caption="Offer inventory evidence" mobileMode="stack" rows={offer.inventoryItem.levels.map((level) => ({ id: level.id, level }))} columns={[{ id: "location", header: "Location", priority: "primary", cell: ({ level }) => level.location.name }, { id: "on-hand", header: "On hand", align: "end", priority: "secondary", cell: ({ level }) => level.onHand }, { id: "available", header: "Available", align: "end", priority: "secondary", cell: ({ level }) => level.available }]} /> : <ProtectedState kind="unavailable" title="No inventory item exists" description="The existing inventory authority has not recorded an item for this offer." />}</OperationalPanel>
    <StorefrontAvailability />
  </ProtectedPageFrame>;
}
