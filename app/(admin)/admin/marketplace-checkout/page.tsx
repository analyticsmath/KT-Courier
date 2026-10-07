import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listMarketplaceCheckoutAdminRecords } from "@/lib/marketplace-checkout/admin-query.service";
import { marketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";

const state = (value: string) => value.replaceAll("_", " ").toLowerCase();
const date = (value: Date | null) => value ? value.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "None recorded";
const reference = { id: "reference", header: "Reference", priority: "primary" as const, cell: (row: { publicReference: string }) => <span className="break-all font-mono text-xs">{row.publicReference}</span> };
const status = { id: "status", header: "State", priority: "primary" as const, cell: (row: { status: string }) => state(row.status) };
const rows = <T extends { publicReference: string }>(records: T[]) => records.map((record) => ({ ...record, id: record.publicReference }));

export default async function MarketplaceCheckoutAdminPage() {
  await requireAdminPagePermission(PERMISSIONS.MARKETPLACE_CHECKOUT_READ, "/admin");
  const ready = marketplaceCheckoutProductionReady();
  const records = await listMarketplaceCheckoutAdminRecords();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Marketplace operations" title="Marketplace checkout" description="Read-only checkout, inventory reservation, settlement and reconciliation records. Each view shows up to 100 most recent records. Times are South African Standard Time." />
    {!ready ? <ProtectedState kind="locked" title="Checkout activity is unavailable" description="Checkout configuration requires review. Existing records remain available for operational diagnosis." /> : null}
    <OperationalPanel title="Checkouts">
      <EditorialTable caption="Checkouts" mobileMode="stack" rows={rows(records.checkouts)} columns={[reference, status,
        { id: "total", header: "Total", cell: (row) => `${row.currency} ${row.grandTotal}` },
        { id: "updated", header: "Updated", cell: (row) => date(row.updatedAt) },
      ]} />
    </OperationalPanel>
    <OperationalPanel title="Marketplace orders">
      <EditorialTable caption="Marketplace orders" mobileMode="stack" rows={rows(records.orders)} columns={[reference, status,
        { id: "total", header: "Total", cell: (row) => `${row.currency} ${row.grandTotal}` },
        { id: "created", header: "Created", cell: (row) => date(row.createdAt) },
      ]} />
    </OperationalPanel>
    <OperationalPanel title="Inventory reservations">
      <EditorialTable caption="Inventory reservations" mobileMode="stack" rows={rows(records.reservations)} columns={[reference, status,
        { id: "expiry", header: "Expires", cell: (row) => date(row.expiresAt) },
        { id: "uncertainty", header: "Payment uncertainty recorded", cell: (row) => date(row.paymentUncertainAt) },
      ]} />
    </OperationalPanel>
    <OperationalPanel title="Settlement records">
      <EditorialTable caption="Settlement records" mobileMode="stack" rows={rows(records.settlements)} columns={[reference, status,
        { id: "basis", header: "Seller basis (ZAR)", cell: (row) => row.sellerBasis },
        { id: "commission", header: "Commission (ZAR)", cell: (row) => row.commissionAmount },
        { id: "earning", header: "Store earning (ZAR)", cell: (row) => row.storeEarningAmount },
        { id: "delivery", header: "Delivery residual (ZAR)", cell: (row) => row.deliveryFeeResidual },
      ]} />
    </OperationalPanel>
    <OperationalPanel title="Reconciliation cases">
      <EditorialTable caption="Reconciliation cases" mobileMode="stack" rows={rows(records.reconciliationCases)} columns={[reference, status,
        { id: "reason", header: "Reason", cell: (row) => state(row.reason) },
        { id: "created", header: "Created", cell: (row) => date(row.createdAt) },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
