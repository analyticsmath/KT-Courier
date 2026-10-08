import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { listStoreInventory } from "@/lib/services/catalog-inventory.service";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { storeCatalogPermission } from "@/lib/catalog/catalog-auth";
import { InventoryCsvUpload } from "@/components/store/InventoryCsvUpload";

export default async function StoreCatalogInventoryPage() {
  await requireBusinessPage("/store/catalog/inventory");
  const { store, user } = await getCurrentStoreForCatalogPage(PERMISSIONS.CATALOG_INVENTORY_READ);
  const [inventory, manage] = await Promise.all([listStoreInventory(store.id), storeCatalogPermission(user.id, PERMISSIONS.CATALOG_INVENTORY_MANAGE)]);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Catalog"
        title="Inventory"
        description="Location-aware inventory projections derived from canonical stock movements. No stock threshold, reservation, or adjustment authority is inferred here."
      />
      <StoreCatalogNavigation />
      {manage.allowed && <InventoryCsvUpload template={inventory.flatMap(item => item.trackingMode === "TRACKED" ? item.levels.filter(level => level.location.status === "ACTIVE").slice(0, 1).map(level => ({ inventoryReference: item.publicReference, locationReference: level.location.publicReference, version: item.version })) : [])} />}
      {inventory.length ? (
        <EditorialTable
          caption="Store inventory records"
          mobileMode="stack"
          rows={inventory.map((item) => ({ id: item.id, item }))}
          columns={[
            {
              id: "product",
              header: "Product",
              priority: "primary",
              cell: ({ item }) => (
                <div>
                  <p className="font-semibold">{item.offer.product.title}</p>
                  <p className="mt-1 text-xs text-[var(--eo-text-muted)]">
                    {item.offer.variant.title}
                  </p>
                </div>
              ),
            },
            {
              id: "tracking",
              header: "Tracking",
              priority: "secondary",
              cell: ({ item }) => item.trackingMode.replaceAll("_", " "),
            },
            {
              id: "locations",
              header: "Locations",
              align: "end",
              priority: "secondary",
              cell: ({ item }) => item.levels.length,
            },
            {
              id: "available",
              header: "Available",
              align: "end",
              priority: "optional",
              cell: ({ item }) =>
                item.trackingMode === "TRACKED"
                  ? item.levels.reduce(
                      (total, level) => total + level.available,
                      0,
                    )
                  : "Policy-managed",
            },
          ]}
        />
      ) : (
        <ProtectedState
          kind="empty"
          title="No inventory records are available"
          description="Inventory appears only after the existing catalog and stock-movement authorities create a store-owned item."
        />
      )}
      <OperationalPanel title="Inventory evidence" padding="compact">
        <p className="text-sm text-[var(--eo-text-secondary)]">
          Receipts, damage, loss, returns, and corrections retain their
          canonical actor, reason, operation, and resulting-stock evidence. This
          page does not add a client-side stock adjustment or reservation flow.
        </p>
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
