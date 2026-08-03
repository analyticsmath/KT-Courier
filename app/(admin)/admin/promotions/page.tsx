import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.PROMOTIONS_READ); return <ProgrammeAdministrationLockedPage title="Promotions" description="Promotion campaign records are not presented until the canonical production authority releases them." />; }
