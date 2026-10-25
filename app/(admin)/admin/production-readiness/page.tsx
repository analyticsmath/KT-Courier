import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getProductionReadiness } from "@/lib/production-readiness/service";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProductionAcceptanceEvidence } from "@/components/admin/ProductionAcceptanceEvidence";
import { ProductionReadinessBoard } from "@/components/admin/ProductionReadinessBoard";
import { listAcceptanceEvidence } from "@/lib/production-readiness/evidence";
import { hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export default async function ProductionReadinessPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.SYSTEM_READINESS_READ);
  const canManage = await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.SYSTEM_READINESS_MANAGE });
  const records = await listAcceptanceEvidence();
  const matrix = await getProductionReadiness();
  return <ProtectedPageFrame>
    <ProtectedPageHeader title="Production readiness" description="Live operational checks, required approvals and exact-release acceptance evidence." />
    <OperationalPanel title={`Release status: ${matrix.status}`} description={`Evidence inspected ${new Date(matrix.generatedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" })} SAST. Infrastructure health: /api/ready.`}>
      <ProductionReadinessBoard capabilities={matrix.capabilities} />
      <div className="mt-10 border-t border-[var(--kt-border)] pt-8">
        <ProductionAcceptanceEvidence records={records} canManage={canManage} />
      </div>
    </OperationalPanel>
  </ProtectedPageFrame>;
}
