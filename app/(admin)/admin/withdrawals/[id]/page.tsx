import { notFound } from "next/navigation";
import { FinanceWithdrawalActions } from "@/components/withdrawals/FinanceWithdrawalActions";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";
import { getFinanceWithdrawal } from "@/lib/services/withdrawal-query.service";
import { withdrawalProductionReadiness } from "@/lib/withdrawals/withdrawal-production-readiness";

export default async function FinanceWithdrawalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.WITHDRAWALS_READ);
  const { id } = await params;
  const withdrawal = await getFinanceWithdrawal(id);
  if (!withdrawal) notFound();
  const current = withdrawal.payoutAttempts.at(-1)?.publicReference ?? null;
  const [canReview, canApprove, canProcess] = await Promise.all([
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.WITHDRAWALS_REVIEW }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.WITHDRAWALS_APPROVE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.WITHDRAWALS_PROCESS }),
  ]);
  const status = presentR21Status(withdrawal.status);

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Finance withdrawal" title="Withdrawal" description={withdrawal.publicReference} actions={<ProtectedStatus {...status} />} />
    <OperationalPanel title="Canonical withdrawal evidence" description="The payout destination is masked and completion is controlled solely by the existing server workflow."><dl className="eo-detail-grid"><div><dt>Amount</dt><dd className="font-mono">R {withdrawal.amount} ZAR</dd></div><div><dt>Status</dt><dd><ProtectedStatus {...status} /></dd></div><div><dt>Destination</dt><dd>{withdrawal.destination.maskedLabel}</dd></div><div><dt>Reserve journal</dt><dd>{withdrawal.journals.reserve}</dd></div><div><dt>Release journal</dt><dd>{withdrawal.journals.release ?? "—"}</dd></div><div><dt>Payout journal</dt><dd>{withdrawal.journals.payout ?? "—"}</dd></div></dl></OperationalPanel>
    {canReview || canApprove || canProcess ? <OperationalPanel title="Canonical controls" description="The server resolved each capability. A maker cannot receive a client-side approval bypass."><FinanceWithdrawalActions id={withdrawal.id} status={withdrawal.status} payoutAttemptReference={current} canReview={canReview} canApprove={canApprove} canProcess={canProcess} completionLocked={!withdrawalProductionReadiness().productionActive} /></OperationalPanel> : null}
    <OperationalPanel title="Immutable history" description="Recorded withdrawal events, ordered by the canonical source."><ActivityTimeline ariaLabel="Withdrawal history" items={withdrawal.history.map((event, index) => ({ id: `${event.createdAt}-${index}`, title: presentR21Status(event.toStatus).label, description: event.reasonCode ?? "Recorded", tone: presentR21Status(event.toStatus).tone }))} /></OperationalPanel>
  </ProtectedPageFrame>;
}
