import Link from "next/link";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { PayoutDestinationCreateForm } from "@/components/withdrawals/PayoutDestinationAdminControls";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import { listFinancePayoutDestinations } from "@/lib/services/withdrawal-query.service";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";

export default async function AdminPayoutDestinationsPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.PAYOUT_DESTINATIONS_READ); const destinations = await listFinancePayoutDestinations(); const canManage = await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.PAYOUT_DESTINATIONS_MANAGE });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Payout Destinations" description="Manage opaque manual-finance references and masked metadata only." />{canManage ? <AdministrationPanel><PayoutDestinationCreateForm /></AdministrationPanel> : null}<AdministrationPanel><EditorialTable caption="Finance payout destinations" mobileMode="stack" rows={destinations.map(row => ({ ...row, id: row.publicReference }))} emptyState={<p role="status">No payout destinations are registered.</p>} columns={[
    { id: "reference", header: "Reference", cell: row => <Link className="eo-table-link" href={`/admin/payout-destinations/${row.publicReference}`}>{row.publicReference}</Link> },
    { id: "owner", header: "Owner type", cell: row => row.ownerType },
    { id: "destination", header: "Masked destination", cell: row => row.maskedLabel },
    { id: "status", header: "Status", cell: row => <ProtectedStatus {...presentR21Status(row.status)} /> },
    { id: "country", header: "Country", cell: row => row.countryCode },
  ]} /><p className="mt-4 text-sm text-slate-600">Raw account numbers, credentials, and banking documents are not accepted or displayed.</p></AdministrationPanel></div>;
}
