import type { Metadata } from "next";
import { DeliveryRegionsManager } from "@/components/admin/DeliveryRegionsManager";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import { formatDateTime } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Service regions" };
export default async function AdminRegionsPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.REGIONS_READ);
  const [regions, canManage] = await Promise.all([listDeliveryRegions(), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.REGIONS_MANAGE })]);
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="People and network" title="Service regions" description="Textual service-region administration. No polygon, boundary editor, or map-provider authority exists in the current route and DTO surface." /><OperationalPanel title="Region directory" description={canManage ? "Canonical region controls are available below." : "Read-only region access. Region controls are omitted without the management permission."}><EditorialTable caption="Service region directory" mobileMode="stack" rows={regions} columns={[
    { id: "name", header: "Region", priority: "primary", cell: (region) => <div><strong>{region.name}</strong><small>{[region.city, region.province].filter(Boolean).join(", ") || "Location description unavailable"}</small></div> },
    { id: "state", header: "State", priority: "primary", cell: (region) => <ProtectedStatus label={region.active ? "Active" : "Inactive"} tone={region.active ? "success" : "neutral"} /> },
    { id: "coverage", header: "Coverage", priority: "secondary", cell: (region) => region.coverageRadiusKm === null ? "Not supplied" : `${region.coverageRadiusKm} km radius` },
    { id: "distance", header: "Maximum distance", priority: "optional", cell: (region) => region.maxDistanceKm === null ? "Not supplied" : `${region.maxDistanceKm} km` },
    { id: "modified", header: "Modified", priority: "secondary", cell: (region) => <time>{formatDateTime(region.updatedAt)}</time> },
  ]} /></OperationalPanel>{canManage ? <OperationalPanel title="Region controls" description="Existing validation and route-matching authority are retained by the canonical management surface."><DeliveryRegionsManager initialRegions={regions} /></OperationalPanel> : null}</ProtectedPageFrame>;
}
