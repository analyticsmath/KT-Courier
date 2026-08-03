import { PromoterAdministrationLockedPage } from "@/components/protected-v2/admin/PromoterAdministrationLockedPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.PROMOTER_QUALIFICATIONS_READ); return <PromoterAdministrationLockedPage title="Promoter qualifications" />; }
