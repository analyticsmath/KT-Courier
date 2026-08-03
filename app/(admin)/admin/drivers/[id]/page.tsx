import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverDetailsConsole } from "@/components/admin/DriverDetailsConsole";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getDriverDetail } from "@/lib/services/admin-drivers.service";
import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Driver record" };
function driverTone(status: string) { return status === "ACTIVE" ? "success" as const : status === "PENDING_REVIEW" ? "warning" as const : status === "SUSPENDED" || status === "REJECTED" ? "danger" as const : "neutral" as const; }

export default async function AdminDriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.DRIVERS_READ);
  const { id } = await params;
  const [driver, canUpdate, canManageStatus, canManageRegions] = await Promise.all([
    getDriverDetail(id),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.DRIVERS_UPDATE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.DRIVERS_STATUS_MANAGE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.DRIVERS_REGIONS_MANAGE }),
  ]);
  if (!driver) notFound();
  const fullConsole = canUpdate && canManageStatus && canManageRegions;

  if (fullConsole) {
    const [allRegions, rawLogs] = await Promise.all([
      listDeliveryRegions(),
      prisma.adminActivityLog.findMany({ where: { entityType: "Driver", entityId: id }, include: { actorUser: { select: { email: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    ]);
    return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Driver administration" title={driver.driverCode} description="Full controls are available because this administrator has the verified update, lifecycle, and region-management permissions." /><OperationalPanel title="Driver operations record"><DriverDetailsConsole initialDriver={driver} allRegions={allRegions.map((region) => ({ id: region.id, name: region.name, slug: region.slug }))} activityLogs={rawLogs.map((log) => ({ id: log.id, action: log.action, message: log.message, createdAt: log.createdAt.toISOString(), actorUser: log.actorUser }))} /></OperationalPanel></ProtectedPageFrame>;
  }

  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Driver administration" title={driver.driverCode} description="Read-only driver record. Controls are omitted unless the full canonical management permission set is present." /><ProtectedContentGrid contextRail={<OperationalPanel title="Operational state"><ProtectedStatus label={driver.status.replaceAll("_", " ")} tone={driverTone(driver.status)} /><p className="eo-panel-copy">Availability: {driver.availability.replaceAll("_", " ")}</p></OperationalPanel>}><div className="grid gap-5"><OperationalPanel title="Driver context"><dl className="eo-detail-grid"><div><dt>Display name</dt><dd>{driver.displayName ?? "Not recorded"}</dd></div><div><dt>Vehicle</dt><dd>{driver.vehicleType?.replaceAll("_", " ") ?? "Not recorded"}</dd></div><div><dt>Service regions</dt><dd>{driver.serviceRegions.map((region) => region.name).join(", ") || "Not assigned"}</dd></div><div><dt>Compliance summary</dt><dd>{driver.documents.length} recorded document{driver.documents.length === 1 ? "" : "s"}</dd></div></dl></OperationalPanel><OperationalPanel title="Access note" tone="subtle"><p className="eo-panel-copy">Exact location, performance rankings, earnings, background-check evidence, and private security data are not displayed in this record.</p></OperationalPanel></div></ProtectedContentGrid></ProtectedPageFrame>;
}
