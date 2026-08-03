import { notFound } from "next/navigation";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { PayoutDestinationStatusActions } from "@/components/withdrawals/PayoutDestinationAdminControls";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import { getFinancePayoutDestination } from "@/lib/services/withdrawal-query.service";

export default async function AdminPayoutDestinationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.PAYOUT_DESTINATIONS_READ); const { id } = await params; const destination = await getFinancePayoutDestination(id); if (!destination) notFound(); const canManage = await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.PAYOUT_DESTINATIONS_MANAGE });
  return <div className="max-w-5xl space-y-6"><ProtectedPageHeader eyebrow="Finance payout destination" title="Payout Destinations" description={destination.publicReference} /><AdministrationPanel><dl className="grid gap-3 sm:grid-cols-2"><div><dt>Masked label</dt><dd>{destination.maskedLabel}</dd></div><div><dt>Institution</dt><dd>{destination.institutionName ?? "—"}</dd></div><div><dt>Last four</dt><dd>{destination.accountLast4 ?? "—"}</dd></div><div><dt>Status</dt><dd>{destination.status}</dd></div></dl></AdministrationPanel>{canManage ? <AdministrationPanel><PayoutDestinationStatusActions publicReference={destination.publicReference} status={destination.status} /></AdministrationPanel> : null}<AdministrationPanel><h2 className="mb-3 text-lg font-semibold">Withdrawal references</h2><ul>{destination.withdrawals.map((withdrawal) => <li key={withdrawal.publicReference}>{withdrawal.publicReference} — {withdrawal.status} — R {withdrawal.amount}</li>)}</ul></AdministrationPanel></div>;
}
