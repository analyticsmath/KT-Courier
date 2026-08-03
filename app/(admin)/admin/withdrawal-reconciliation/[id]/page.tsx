import { notFound } from "next/navigation";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getWithdrawalReconciliation } from "@/lib/services/withdrawal-query.service";

export default async function WithdrawalReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.WITHDRAWALS_RECONCILE); const { id } = await params; const caseRow = await getWithdrawalReconciliation(id); if (!caseRow) notFound();
  return <div className="max-w-4xl space-y-6"><ProtectedPageHeader eyebrow="Withdrawal reconciliation" title="Withdrawal Reconciliation" description={caseRow.publicReference} /><AdministrationPanel><dl className="grid gap-3 sm:grid-cols-2"><div><dt>Withdrawal</dt><dd>{caseRow.withdrawalReference}</dd></div><div><dt>Amount</dt><dd>R {caseRow.amount}</dd></div><div><dt>Reason</dt><dd>{caseRow.reason}</dd></div><div><dt>Status</dt><dd>{caseRow.status}</dd></div><div><dt>Priority</dt><dd>{caseRow.priority}</dd></div><div><dt>Resolution</dt><dd>{caseRow.resolutionCode ?? "Unresolved"}</dd></div></dl><p className="mt-4 text-sm">{caseRow.summary}</p></AdministrationPanel></div>;
}
