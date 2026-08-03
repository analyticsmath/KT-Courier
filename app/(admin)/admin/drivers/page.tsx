import type { Metadata } from "next";
import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDrivers } from "@/lib/services/admin-drivers.service";

export const metadata: Metadata = { title: "Driver administration" };
function driverTone(status: string) { return status === "ACTIVE" ? "success" as const : status === "PENDING_REVIEW" ? "warning" as const : status === "SUSPENDED" || status === "REJECTED" ? "danger" as const : "neutral" as const; }
function availabilityTone(status: string) { return status === "AVAILABLE" ? "success" as const : status === "ON_DELIVERY" ? "information" as const : status === "UNAVAILABLE" ? "warning" as const : "neutral" as const; }

export default async function AdminDriversPage() {
  await requireAdminPagePermission(PERMISSIONS.DRIVERS_READ);
  const { data: drivers, total } = await listDrivers({ page: 1, pageSize: 100 });
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="People and network" title="Driver administration" description={`${total} source-backed driver profile${total === 1 ? "" : "s"}. Search and lifecycle controls remain available on the dedicated, permission-aware driver record.`} /><OperationalPanel title="Driver directory" description="The list excludes exact location, performance rankings, earnings, and internal risk evidence."><EditorialTable caption="Driver administration directory" mobileMode="stack" rows={drivers} emptyState={<ProtectedState kind="empty" title="No driver profiles are available" description="Driver profiles appear once supplied by the canonical service." />} columns={[
    { id: "driver", header: "Driver", priority: "primary", cell: (driver) => <div><Link className="eo-table-link" href={`/admin/drivers/${driver.id}`}>{driver.displayName ?? driver.driverCode}</Link><small>{driver.driverCode}</small></div> },
    { id: "status", header: "Operational state", priority: "primary", cell: (driver) => <ProtectedStatus label={driver.status.replaceAll("_", " ")} tone={driverTone(driver.status)} /> },
    { id: "availability", header: "Availability", priority: "secondary", cell: (driver) => <ProtectedStatus label={driver.availability.replaceAll("_", " ")} tone={availabilityTone(driver.availability)} /> },
    { id: "region", header: "Primary region", priority: "secondary", cell: (driver) => driver.primaryRegion?.name ?? "Not assigned" },
    { id: "vehicle", header: "Vehicle", priority: "optional", cell: (driver) => driver.vehicleType?.replaceAll("_", " ") ?? "Not recorded" },
    { id: "action", header: "", priority: "optional", cell: (driver) => <Link className="eo-table-action" href={`/admin/drivers/${driver.id}`}>Open<span className="sr-only"> {driver.driverCode}</span></Link> },
  ]} /></OperationalPanel></ProtectedPageFrame>;
}
