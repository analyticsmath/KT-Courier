import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.SUBSCRIPTION_PROGRAMS_READ); return <ProgrammeAdministrationLockedPage title="Subscription programmes" description="Subscription programme grouping remains an authority-led administration surface." />; }
