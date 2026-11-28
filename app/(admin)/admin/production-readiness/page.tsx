import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getProductionReadiness } from "@/lib/production-readiness/service";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProductionAcceptanceEvidence } from "@/components/admin/ProductionAcceptanceEvidence";
import { ProductionReadinessBoard } from "@/components/admin/ProductionReadinessBoard";
import { listAcceptanceEvidence } from "@/lib/production-readiness/evidence";
import { listQaFunctionalAcceptanceEvidence } from "@/lib/production-readiness/qa-functional-evidence";
import { hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export default async function ProductionReadinessPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.SYSTEM_READINESS_READ);
  const [canManage, records, qaRecords, matrix] = await Promise.all([
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.SYSTEM_READINESS_MANAGE }),
    listAcceptanceEvidence(),
    listQaFunctionalAcceptanceEvidence(),
    getProductionReadiness(),
  ]);
  return <ProtectedPageFrame>
    <ProtectedPageHeader title="Production readiness" description="Live operational checks, required approvals and exact-release acceptance evidence." />
    <OperationalPanel title={`Release status: ${matrix.status}`} description={`Evidence inspected ${new Date(matrix.generatedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" })} SAST. Infrastructure health: /api/ready.`}>
      <ProductionReadinessBoard
        capabilities={matrix.capabilities}
        capabilityMatrix={matrix.capabilityMatrix}
        matrixReconciliation={matrix.matrixReconciliation}
        moduleActivations={matrix.moduleActivations}
        envSchema={matrix.envSchema}
        commerceActivation={matrix.commerceActivation}
        entityConfigurationStatus={matrix.entityConfigurationStatus}
      />
      <div className="mt-10 border-t border-[var(--kt-border)] pt-8">
        <ProductionAcceptanceEvidence records={records} qaRecords={qaRecords} canManage={canManage} />
      </div>
    </OperationalPanel>
  </ProtectedPageFrame>;
}
