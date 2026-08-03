import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.SUBSCRIPTION_CONTRACTS_RECONCILE); return <ProgrammeAdministrationLockedPage title="Subscription reconciliation" description="Provider, invoice, entitlement, and cancellation recovery remains canonical and server-controlled." />; }
