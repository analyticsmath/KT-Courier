import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { operationalWorkflowStatus, reconciliationReason } from "@/lib/commerce-admin-presentation/store-order-reconciliation";
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
    operationalScope: string;
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
      storeOrder: { select: { publicReference: true, operationalScope: true, status: true, acceptanceStatus: true, preparationStatus: true, deliveryBridgeStatus: true, store: { select: { name: true } } } },
    },
  });
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Marketplace operations" title="Store-order reconciliation" description="Review fulfilment discrepancies for marketplace store orders. Financial issues are reviewed in the finance reconciliation desks." />
    <p>Historical records remain available for reference. They do not enter new fulfilment or settlement queues; their original case status is preserved.</p>
    <OperationalPanel title="Operational reconciliation cases" description="This read-only queue shows order references, fulfilment status, discrepancy summaries and timestamps. Use the authorised order workflow for any action.">
      <EditorialTable caption="Marketplace store-order operational reconciliation cases" mobileMode="stack" rows={cases} emptyState={<ProtectedState kind="empty" title="No store-order reconciliation cases" description="No canonical operational reconciliation case is available." />} columns={[
        { id: "reference", header: "Case", priority: "primary", cell: (item) => <span className="font-mono text-xs">{item.publicReference}</span> },
        { id: "storeOrder", header: "Marketplace store order", priority: "primary", cell: (item) => <div><span className="block break-all font-mono text-xs">{item.storeOrder?.publicReference ?? "Store order unavailable"}</span><small className="block mt-1">{item.storeOrder?.store?.name ?? "Store unavailable"}</small></div> },
        { id: "scope", header: "Order scope", priority: "secondary", cell: (item) => item.storeOrder?.operationalScope === "HISTORICAL" ? "Historical record · read only" : "Live operations" },
        { id: "fulfilment", header: "Operational state", priority: "secondary", cell: (item) => item.storeOrder ? <dl className="grid min-w-0 gap-2 text-xs">{operationalWorkflowStatus(item.storeOrder).map(state => <div key={state.label} className="grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-baseline"><dt className="text-[var(--kt-text-soft)]">{state.label}</dt><dd className="min-w-0 break-words font-medium text-[var(--kt-brand-navy)]">{state.value}</dd></div>)}</dl> : "Unavailable" },
        { id: "reason", header: "Discrepancy", priority: "secondary", cell: (item) => <div className="min-w-0"><span className="block break-words">{reconciliationReason(item.reasonCode)}</span><details className="mt-2 text-xs text-[var(--kt-text-soft)]"><summary className="cursor-pointer">Technical reason</summary><code className="mt-1 block break-all font-mono">{item.reasonCode}</code></details></div> },
        { id: "summary", header: "Safe summary", priority: "optional", cell: (item) => item.safeSummary },
        { id: "caseState", header: "Case state", priority: "secondary", cell: (item) => { const state = presentCommerceStatus(item.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "observed", header: "Last updated", priority: "secondary", cell: (item) => <time>{formatDateTime(item.updatedAt)}</time> },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
