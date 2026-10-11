import { requireAdminPagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listParcelProfileVersions } from "@/lib/commercial/parcel-profiles";
import { ParcelProfilesManager } from "@/components/admin/ParcelProfilesManager";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export default async function ParcelProfilesPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_READ);
  const [rows, canManage] = await Promise.all([listParcelProfileVersions(), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE })]);
  const initial = rows.map((row) => ({ id: row.id, stableKey: row.stableKey, versionNumber: row.versionNumber, displayName: row.displayName, status: row.status, ...Object.fromEntries(["lengthCm", "widthCm", "heightCm", "maximumWeightKg"].map((key) => [key, row[key as "lengthCm"] == null ? null : Number(row[key as "lengthCm"])])) as { lengthCm: number | null; widthCm: number | null; heightCm: number | null; maximumWeightKg: number | null }, effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: row.effectiveTo?.toISOString() ?? null }));
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Operations" title="Parcel profiles" description="Review the supplied Small, Medium, and Large examples and maintain versioned acceptance limits." /><OperationalPanel title="Profiles and version history"><ParcelProfilesManager initial={initial} canManage={canManage} /></OperationalPanel></ProtectedPageFrame>;
}
