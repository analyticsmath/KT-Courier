import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";
import { requireRefundPagePermission } from "@/lib/refunds/page-permission";
import { listFinanceRefunds } from "@/lib/services/refund-query.service";

export default async function FinanceRefundsPage() {
  await requireRefundPagePermission(PERMISSIONS.REFUNDS_READ);
  const refunds = await listFinanceRefunds({ page: 1, pageSize: 50 });

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader eyebrow="Finance administration" title="Refunds" description="Review exact customer refund reservations, methods, funding and reconciliation state." />
      <OperationalPanel title="Refund queue" description="The list is a safe source-backed projection; it does not determine provider success or completion.">
        <EditorialTable caption="Finance refund records" mobileMode="stack" rows={refunds.data} emptyState={<p className="eo-table-empty" role="status">No refunds are available.</p>} columns={[
          { id: "reference", header: "Reference", priority: "primary", cell: (row) => <Link className="eo-table-link" href={`/admin/refunds/${row.id}`}>{row.publicReference}</Link> },
          { id: "payment", header: "Payment / order", priority: "secondary", cell: (row) => <>{row.paymentReference}<small>{row.orderReference}</small></> },
          { id: "customer", header: "Customer", priority: "optional", cell: (row) => row.customer.name },
          { id: "amount", header: "Amount", align: "end", cell: (row) => <span className="font-mono tabular-nums">R {row.amount}</span> },
          { id: "method", header: "Method", cell: (row) => row.method },
          { id: "status", header: "State", cell: (row) => <ProtectedStatus {...presentR21Status(row.status)} /> },
          { id: "reconciliation", header: "Reconciliation", cell: (row) => <ProtectedStatus label={row.reconciliationRequired ? "Required" : "Clear"} tone={row.reconciliationRequired ? "warning" : "success"} /> },
        ]} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
