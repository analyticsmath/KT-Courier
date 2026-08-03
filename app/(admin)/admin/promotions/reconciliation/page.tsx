import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.PROMOTIONS_RECONCILIATION_READ); return <ProgrammeAdministrationLockedPage title="Promotion reconciliation" description="Promotion reconciliation remains a server-controlled recovery route without manual settlement." />; }
