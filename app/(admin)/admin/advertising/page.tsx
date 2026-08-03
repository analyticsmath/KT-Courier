import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

export default async function AdminAdvertisingPage() {
  await requireAdminPagePermission(PERMISSIONS.ADVERTISING_READ);
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Commercial programmes" title="Advertising administration" description="A protected advertising administration route." />
    <ProtectedState kind="locked" title="Advertising activation is production locked" description="No placement creation, rate-card activation, campaign moderation, funding, reconciliation resolution, metric, chart, audience estimate, budget, or attribution output is rendered while the canonical production authority is locked." />
  </ProtectedPageFrame>;
}
