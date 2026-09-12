import type { Metadata } from "next";
import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel, MetricTile } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listAdminVehicles } from "@/lib/services/vehicle-compliance.service";

export const metadata: Metadata = { title: "Fleet vehicles compliance" };

export default async function AdminVehiclesPage() {
  await requireAdminPagePermission(PERMISSIONS.DRIVERS_READ);
  const vehicles = await listAdminVehicles();

  const total = vehicles.length;
  const approved = vehicles.filter((v) => v.status === "APPROVED").length;
  const pending = vehicles.filter((v) => v.status === "PENDING_REVIEW").length;
  const rejected = vehicles.filter((v) => v.status === "REJECTED").length;

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Fleet compliance"
        title="Fleet Vehicles"
        description="Verify and audit driver-operated fleet vehicles, registration documents, licence discs, and insurance records."
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricTile label="Total Fleet" value={total} description="Registered fleet vehicles" />
          <MetricTile label="Compliant" value={approved} description="Approved for dispatch" />
          <MetricTile label="Pending Review" value={pending} description="Awaiting admin review" />
          <MetricTile label="Action Required" value={rejected} description="Rejected or suspended" />
        </div>

        <OperationalPanel title="Registered Fleet Roster">
          {vehicles.length === 0 ? (
            <p className="text-sm text-[var(--kt-text-muted)] py-6 text-center italic">
              No fleet vehicles have been registered yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-[var(--kt-soft-border)] text-[var(--kt-ink-navy)] uppercase tracking-wider font-extrabold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Plate / Type</th>
                    <th className="py-2.5 px-3">Driver</th>
                    <th className="py-2.5 px-3">Documents</th>
                    <th className="py-2.5 px-3">Compliance Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--kt-soft-border)]">
                  {vehicles.map((v) => {
                    const approvedDocs = v.documents.filter((d) => d.status === "APPROVED").length;
                    return (
                      <tr key={v.id} className="hover:bg-[var(--kt-cool-gray)] transition-colors">
                        <td className="py-3 px-3 font-bold text-[var(--kt-ink-navy)]">
                          {v.make} {v.model} {v.year ? `(${v.year})` : ""}
                          <span className="block text-[10px] text-[var(--kt-text-muted)] font-normal">
                            Colour: {v.colour || "Not set"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-[var(--kt-ink-navy)]">
                            {v.registrationNumber}
                          </span>
                          <span className="block text-[10px] text-[var(--kt-text-muted)]">
                            {v.vehicleType}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-[var(--kt-ink-navy)]">
                            {v.driverProfile?.displayName || "Driver"}
                          </span>
                          <span className="block text-[10px] text-[var(--kt-text-muted)] font-mono">
                            {v.driverProfile?.driverCode}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium">
                            {approvedDocs} / 3 approved
                          </span>
                          <span className="block text-[10px] text-[var(--kt-text-muted)]">
                            {v.documents.length} uploaded
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <ProtectedStatus
                            label={v.status}
                            tone={
                              v.status === "APPROVED"
                                ? "success"
                                : v.status === "REJECTED"
                                ? "danger"
                                : "warning"
                            }
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          {v.driverProfile?.id && (
                            <Link
                              href={`/admin/drivers/${v.driverProfile.id}`}
                              className="text-xs font-bold text-[var(--kt-signal-cobalt)] hover:underline"
                            >
                              Inspect Driver →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </OperationalPanel>
      </div>
    </ProtectedPageFrame>
  );
}
