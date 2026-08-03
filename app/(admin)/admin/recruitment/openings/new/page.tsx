import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.RECRUITMENT_OPENINGS_MANAGE); return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Recruitment administration" title="Create job opening" description="Opening creation remains a canonical server mutation." /><ProtectedState kind="locked" title="Opening creation is production locked" description="No form is rendered while the recruitment production lock is active. This route does not fabricate requisitions, terms, or publication readiness." /></ProtectedPageFrame>; }
