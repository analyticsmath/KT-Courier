import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils/formatters";

type StoreOrderOperationalCase = Readonly<{
  id: string;
  publicReference: string;
  reasonCode: string;
  status: string;
  priority: string;
  safeSummary: string;
  createdAt: Date;
  updatedAt: Date;
  storeOrder?: Readonly<{
    publicReference: string;
    status: string;
    acceptanceStatus: string;
    preparationStatus: string;
    deliveryBridgeStatus: string;
    store?: Readonly<{ name: string }> | null;
  }> | null;
}>;

export default async function StoreOrderReconciliationPage() {
  await requireAdminPagePermission(PERMISSIONS.STORE_ORDERS_RECONCILE);
  const cases = await (prisma as unknown as { marketplaceStoreOrderReconciliationCase: { findMany(args: unknown): Promise<StoreOrderOperationalCase[]> } }).marketplaceStoreOrderReconciliationCase.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true, publicReference: true, reasonCode: true, status: true, priority: true, safeSummary: true, createdAt: true, updatedAt: true,
      storeOrder: { select: { publicReference: true, status: true, acceptanceStatus: true, preparationStatus: true, deliveryBridgeStatus: true, store: { select: { name: true } } } },
    },
  });
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Marketplace operations" title="Store-order reconciliation" description="Read-only operational discrepancy triage for marketplace store orders. Payment, refund, payout, ledger, commission, and financial reconciliation remain outside R20." />
    <OperationalPanel title="Operational reconciliation cases" description="This queue distinguishes marketplace store orders from courier orders. It contains only canonical operational references, state, safe summary, and timestamps; it performs no retry or financial action.">
      <EditorialTable caption="Marketplace store-order operational reconciliation cases" mobileMode="stack" rows={cases} emptyState={<ProtectedState kind="empty" title="No store-order reconciliation cases" description="No canonical operational reconciliation case is available." />} columns={[
        { id: "reference", header: "Case", priority: "primary", cell: (item) => <span className="font-mono text-xs">{item.publicReference}</span> },
        { id: "storeOrder", header: "Marketplace store order", priority: "primary", cell: (item) => <div>{item.storeOrder?.publicReference ?? "Store order unavailable"}<small>{item.storeOrder?.store?.name ?? "Store unavailable"}</small></div> },
        { id: "fulfilment", header: "Operational state", priority: "secondary", cell: (item) => item.storeOrder ? <div><ProtectedStatus label={presentCommerceStatus(item.storeOrder.status).label} tone={presentCommerceStatus(item.storeOrder.status).tone} /><small>{item.storeOrder.acceptanceStatus} · {item.storeOrder.preparationStatus} · {item.storeOrder.deliveryBridgeStatus}</small></div> : "Unavailable" },
        { id: "reason", header: "Discrepancy", priority: "secondary", cell: (item) => item.reasonCode },
        { id: "summary", header: "Safe summary", priority: "optional", cell: (item) => item.safeSummary },
        { id: "caseState", header: "Case state", priority: "secondary", cell: (item) => { const state = presentCommerceStatus(item.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "observed", header: "Last updated", priority: "secondary", cell: (item) => <time>{formatDateTime(item.updatedAt)}</time> },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
