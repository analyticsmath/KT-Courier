import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.PROMOTIONS_RECONCILIATION_READ); return <ProgrammeAdministrationLockedPage title="Promotion reconciliation detail" description="The canonical recovery case is not rendered while the production authority remains locked." />; }
