import { ProgrammeAdministrationLockedPage } from "@/components/protected-v2/admin/ProgrammeAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.SUBSCRIPTION_CONTRACTS_READ); return <ProgrammeAdministrationLockedPage title="Subscription contracts" description="Safe contract and billing evidence is protected by the existing subscription authority." />; }
