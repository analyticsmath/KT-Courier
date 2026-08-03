import type { Metadata } from "next";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus, type ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStoreStatusConfig } from "@/lib/constants/statuses";
import { listStores } from "@/lib/services/admin-stores.service";

export const metadata: Metadata = { title: "Store administration" };
function tone(variant: string): ProtectedStatusTone { return variant === "green" ? "success" : variant === "amber" ? "warning" : variant === "red" ? "danger" : variant === "blue" ? "information" : "neutral"; }

export default async function AdminStoresPage() {
  await requireAdminPagePermission(PERMISSIONS.STORES_READ);
  const { data: stores, total } = await listStores({ page: 1, pageSize: 100 });
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="People and network" title="Store administration" description={`${total} source-backed store account${total === 1 ? "" : "s"}. Store detail and approval-state action routes are not present in this administrative tree.`} /><OperationalPanel title="Store directory" description="Storefront publication and checkout locks remain independent from store account state."><EditorialTable caption="Store administration directory" mobileMode="stack" rows={stores} emptyState={<ProtectedState kind="empty" title="No stores are available" description="Store accounts appear here once supplied by the canonical list service." />} columns={[
    { id: "store", header: "Store", priority: "primary", cell: (store) => <div><strong>{store.name}</strong><small>/{store.slug}</small></div> },
    { id: "owner", header: "Owner context", priority: "secondary", cell: (store) => store.ownerUser?.email ?? "Owner unavailable" },
    { id: "contact", header: "Contact", priority: "optional", cell: (store) => store.contactName ?? "Not supplied" },
    { id: "state", header: "Operational state", priority: "primary", cell: (store) => { const state = getStoreStatusConfig(store.status); return <ProtectedStatus label={state.label} tone={tone(state.variant)} />; } },
    { id: "storefront", header: "Storefront", priority: "secondary", cell: () => <ProtectedStatus label="Publication locked" tone="locked" /> },
  ]} /></OperationalPanel></ProtectedPageFrame>;
}
