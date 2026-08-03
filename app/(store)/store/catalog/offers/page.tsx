import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation, StorefrontAvailability } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { listStoreCatalogOffers } from "@/lib/services/store-offer.service";

export default async function StoreCatalogOffersPage() {
  const { store } = await getCurrentStoreForCatalogPage();
  const offers = await listStoreCatalogOffers(store.id, { page: 1, pageSize: 100 });
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog" title="Store offers" description="The exact variants this store proposes to sell. Price and inventory are separate canonical evidence." />
    <StoreCatalogNavigation />
    {offers.length ? <EditorialTable caption="Store catalog offers" mobileMode="stack" rows={offers.map((offer) => ({ id: offer.id, offer }))} columns={[
      { id: "sku", header: "Offer", priority: "primary", cell: ({ offer }) => <Link className="font-mono font-semibold" href={`/store/catalog/offers/${offer.publicReference}`}>{offer.storeSku}</Link> },
      { id: "product", header: "Product / variant", priority: "secondary", cell: ({ offer }) => <div><p>{offer.product.title}</p><p className="mt-1 text-xs text-[var(--eo-text-muted)]">{offer.variant.title}</p></div> },
      { id: "offer", header: "Offer state", priority: "secondary", cell: ({ offer }) => <ProtectedStatus label={offer.status.replaceAll("_", " ")} /> },
      { id: "inventory", header: "Inventory", priority: "optional", cell: ({ offer }) => offer.inventoryItem?.trackingMode.replaceAll("_", " ") ?? "Not established" },
    ]} /> : <ProtectedState kind="empty" title="No store offers are available" description="Create a canonical product draft before attaching a store offer." action={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white" href="/store/catalog/products/new">New product</Link>} />}
    <StorefrontAvailability />
  </ProtectedPageFrame>;
}
