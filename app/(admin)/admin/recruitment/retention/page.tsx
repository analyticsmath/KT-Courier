import { RecruitmentAdministrationPage } from "@/components/protected-v2/recruitment-admin/RecruitmentAdministrationPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.RECRUITMENT_RETENTION_MANAGE); return <RecruitmentAdministrationPage kind="retention" />; }
