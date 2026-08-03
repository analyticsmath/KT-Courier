import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.PROMOTIONS_MANAGE); return <ProgrammeAdministrationLockedPage title="Create promotion" description="Promotion creation remains a canonical mutation and no speculative form is rendered." />; }
