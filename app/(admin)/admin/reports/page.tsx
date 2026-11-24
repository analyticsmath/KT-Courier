import Link from "next/link";
import { ModuleActivationControl } from "@/components/admin/ModuleActivationControl";
import { ProtectedPageFrame } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { resolveReportingActivationState } from "@/lib/reporting/activation";

export const dynamic = "force-dynamic";

export default async function AdminReportsOverviewPage() {
  await requireAdminPagePermission(PERMISSIONS.REPORT_DEFINITION_READ);
  const activation = await resolveReportingActivationState();

  return (
    <ProtectedPageFrame>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporting & Export Control Centre</h1>
          <p className="text-sm text-gray-600">
            Manage system report definitions, execution jobs, export artifacts, governed activation, and reconciliation.
          </p>
        </div>

        <ModuleActivationControl
          moduleKey="REPORTING"
          title="Reporting & CSV Exports Production Activation"
          initialState={activation}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            href="/admin/reports/definitions"
            className="p-6 bg-white rounded-lg shadow border border-gray-200  transition block"
          >
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Report Definitions</h3>
            <p className="text-xs text-gray-500">View and audit versioned system report definitions.</p>
          </Link>

          <Link
            href="/admin/reports/jobs"
            className="p-6 bg-white rounded-lg shadow border border-gray-200  transition block"
          >
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Report Jobs</h3>
            <p className="text-xs text-gray-500">Monitor all queued, running, completed, and failed jobs.</p>
          </Link>

          <Link
            href="/admin/reports/artifacts"
            className="p-6 bg-white rounded-lg shadow border border-gray-200  transition block"
          >
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Export Artifacts</h3>
            <p className="text-xs text-gray-500">Inspect stored artifact references, hashes, and retention.</p>
          </Link>

          <Link
            href="/admin/reports/reconciliation"
            className="p-6 bg-white rounded-lg shadow border border-gray-200  transition block"
          >
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Reconciliation</h3>
            <p className="text-xs text-gray-500">Audit system reporting discrepancies and anomaly cases.</p>
          </Link>
        </div>
      </div>
    </ProtectedPageFrame>
  );
}
