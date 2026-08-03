import { notFound } from "next/navigation";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getCommissionReconciliation } from "@/lib/services/commission-query.service";

export default async function CommissionReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.COMMISSION_RECONCILIATION_READ); const record = await getCommissionReconciliation((await params).id); if (!record) notFound();
  return <div className="max-w-4xl space-y-6"><ProtectedPageHeader eyebrow="Commission exception" title="Commission Reconciliation" description={`${record.publicReference} — ${record.status}`} /><AdministrationPanel><dl><dt>Accrual</dt><dd>{record.accrualReference}</dd><dt>Allocation</dt><dd>{record.allocationReference ?? "None"}</dd><dt>Reason</dt><dd>{record.reason}</dd><dt>Priority</dt><dd>{record.priority}</dd><dt>Summary</dt><dd>{record.safeSummary}</dd><dt>Observations</dt><dd>{record.observationCount}</dd><dt>Resolution</dt><dd>{record.resolutionCode ?? "Unresolved"}</dd></dl></AdministrationPanel></div>;
}
