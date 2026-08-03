import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";
import { listFinanceWithdrawals } from "@/lib/services/withdrawal-query.service";

export default async function FinanceWithdrawalsPage() {
  await requireAdminPagePermission(PERMISSIONS.WITHDRAWALS_READ);
  const withdrawals = await listFinanceWithdrawals({ page: 1, pageSize: 50 });

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Finance administration" title="Withdrawals" description="Review reserved owner withdrawals and safe payout evidence." />
    <OperationalPanel title="Withdrawal queue" description="Masked destinations and canonical state only. A payout is not completed until the authoritative workflow records it.">
      <EditorialTable caption="Finance withdrawal records" mobileMode="stack" rows={withdrawals.data} emptyState={<p className="eo-table-empty" role="status">No withdrawals are available.</p>} columns={[
        { id: "reference", header: "Reference", priority: "primary", cell: (row) => <Link className="eo-table-link" href={`/admin/withdrawals/${row.id}`}>{row.publicReference}</Link> },
        { id: "owner", header: "Owner type", priority: "secondary", cell: (row) => row.ownerType },
        { id: "amount", header: "Amount", align: "end", cell: (row) => <span className="font-mono tabular-nums">R {row.amount}</span> },
        { id: "status", header: "State", cell: (row) => <ProtectedStatus {...presentR21Status(row.status)} /> },
        { id: "destination", header: "Masked destination", priority: "optional", cell: (row) => row.destination.maskedLabel },
        { id: "reconciliation", header: "Reconciliation", cell: (row) => <ProtectedStatus label={row.reconciliationRequired ? "Required" : "Clear"} tone={row.reconciliationRequired ? "warning" : "success"} /> },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
