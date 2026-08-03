import Link from "next/link";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { PayoutDestinationCreateForm } from "@/components/withdrawals/PayoutDestinationAdminControls";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import { listFinancePayoutDestinations } from "@/lib/services/withdrawal-query.service";

export default async function AdminPayoutDestinationsPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.PAYOUT_DESTINATIONS_READ); const destinations = await listFinancePayoutDestinations(); const canManage = await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.PAYOUT_DESTINATIONS_MANAGE });
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Payout Destinations" description="Manage opaque manual-finance references and masked metadata only." />{canManage ? <AdministrationPanel><PayoutDestinationCreateForm /></AdministrationPanel> : null}<AdministrationPanel>{destinations.length ? <table className="w-full text-left text-sm" aria-label="payout-destinations-admin-table"><thead><tr><th>Reference</th><th>Owner type</th><th>Masked destination</th><th>Status</th><th>Country</th></tr></thead><tbody>{destinations.map((destination) => <tr key={destination.publicReference}><td><Link href={`/admin/payout-destinations/${destination.publicReference}`}>{destination.publicReference}</Link></td><td>{destination.ownerType}</td><td>{destination.maskedLabel}</td><td>{destination.status}</td><td>{destination.countryCode}</td></tr>)}</tbody></table> : <p role="status">No payout destinations are registered.</p>}<p className="mt-4 text-sm text-slate-600">Raw account numbers, credentials, and banking documents are not accepted or displayed.</p></AdministrationPanel></div>;
}
