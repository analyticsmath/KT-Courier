import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.PROMOTIONS_READ); return <ProgrammeAdministrationLockedPage title="Promotion detail" description="Promotion lifecycle and settlement evidence remain unavailable through the protected production authority." />; }
