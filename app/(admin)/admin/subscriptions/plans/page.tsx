import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.SUBSCRIPTION_PLANS_READ); return <ProgrammeAdministrationLockedPage title="Subscription plan versions" description="Versioned subscription plan records remain under canonical review and activation authority." />; }
