import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getProductionReadiness } from "@/lib/production-readiness/service";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProductionAcceptanceEvidence } from "@/components/admin/ProductionAcceptanceEvidence";
import { listAcceptanceEvidence } from "@/lib/production-readiness/evidence";
import { hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export default async function ProductionReadinessPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.SYSTEM_READINESS_READ);
  const canManage = await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.SYSTEM_READINESS_MANAGE });
  const records = await listAcceptanceEvidence();
  const matrix = await getProductionReadiness();
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Operations" title="Production readiness" description="Business capability gates, configuration gaps, and genuine operator acceptance requirements." />
    <OperationalPanel title={`Release status: ${matrix.status}`} description={`Observed ${matrix.generatedAt}. Infrastructure health remains available at /api/ready.`}>
      <nav aria-label="Readiness actions" className="flex flex-wrap gap-4"><a href="/admin/regions">Operational coverage</a><a href="/admin/pricing">Pricing</a><a href="/admin/notifications">Notifications</a><a href="/admin/integrations">Provider diagnostics</a></nav>
      <ul className="mt-6 space-y-4">{matrix.capabilities.map((entry) => <li key={entry.key} className="rounded-lg border border-[var(--kt-soft-border)] p-4"><h2 className="font-semibold">{entry.key.replaceAll("_", " ")}</h2><p>{entry.status} · {entry.severity} · {entry.owner}</p><p>{entry.safeSummary}</p><p className="text-sm">Reason: {entry.reasonCode}</p>{entry.evidence ? <dl>{Object.entries(entry.evidence).map(([key, value]) => <div key={key}><dt>{key}</dt><dd className="break-words">{Array.isArray(value) ? value.join("; ") || "None" : String(value)}</dd></div>)}</dl> : null}</li>)}</ul>
      <ProductionAcceptanceEvidence records={records} canManage={canManage} />
    </OperationalPanel></ProtectedPageFrame>;
}
