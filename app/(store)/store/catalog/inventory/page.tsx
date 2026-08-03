import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { listStoreInventory } from "@/lib/services/catalog-inventory.service";

export default async function StoreCatalogInventoryPage() {
  const { store } = await getCurrentStoreForCatalogPage();
  const inventory = await listStoreInventory(store.id);
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog" title="Inventory" description="Location-aware inventory projections derived from canonical stock movements. No stock threshold, reservation, or adjustment authority is inferred here." />
    <StoreCatalogNavigation />
    {inventory.length ? <EditorialTable caption="Store inventory records" mobileMode="stack" rows={inventory.map((item) => ({ id: item.id, item }))} columns={[
      { id: "product", header: "Product", priority: "primary", cell: ({ item }) => <div><p className="font-semibold">{item.offer.product.title}</p><p className="mt-1 text-xs text-[var(--eo-text-muted)]">{item.offer.variant.title}</p></div> },
      { id: "tracking", header: "Tracking", priority: "secondary", cell: ({ item }) => item.trackingMode.replaceAll("_", " ") },
      { id: "locations", header: "Locations", align: "end", priority: "secondary", cell: ({ item }) => item.levels.length },
      { id: "available", header: "Available", align: "end", priority: "optional", cell: ({ item }) => item.trackingMode === "TRACKED" ? item.levels.reduce((total, level) => total + level.available, 0) : "Policy-managed" },
    ]} /> : <ProtectedState kind="empty" title="No inventory records are available" description="Inventory appears only after the existing catalog and stock-movement authorities create a store-owned item." />}
    <OperationalPanel title="Inventory evidence" padding="compact"><p className="text-sm text-[var(--eo-text-secondary)]">Receipts, damage, loss, returns, and corrections retain their canonical actor, reason, operation, and resulting-stock evidence. This page does not add a client-side stock adjustment or reservation flow.</p></OperationalPanel>
  </ProtectedPageFrame>;
}
