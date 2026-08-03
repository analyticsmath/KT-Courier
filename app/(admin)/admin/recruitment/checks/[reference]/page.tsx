import { RecruitmentAdministrationPage } from "@/components/protected-v2/recruitment-admin/RecruitmentAdministrationPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page({ params }: { params: Promise<{ reference: string }> }) { await requireAdminPagePermission(PERMISSIONS.RECRUITMENT_CHECKS_READ); return <RecruitmentAdministrationPage kind="check" reference={(await params).reference} />; }
