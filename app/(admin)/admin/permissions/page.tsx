import type { Metadata } from "next";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getRolePermissions, listPermissions } from "@/lib/services/admin-permissions.service";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Permissions" };

export default async function AdminPermissionsPage() {
  await requireAdminPagePermission(PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE);
  const [{ definitions, grouped }, adminRolePermissions] = await Promise.all([listPermissions(), getRolePermissions(UserRole.ADMIN)]);
  const enabledAdminKeys = new Set(adminRolePermissions.enabledPermissionKeys);
  const definitionGroups = definitions.reduce<Record<string, typeof definitions>>((acc, permission) => {
    acc[permission.category] ??= [];
    acc[permission.category].push(permission);
    return acc;
  }, {});
  const dbPermissionCount = Object.values(grouped).reduce((total, permissions) => total + permissions.length, 0);

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Governance" title="Permissions" description="Canonical registry and recorded ADMIN role defaults. Browser presentation is never an authorization boundary." />
    <div className="grid gap-3 sm:grid-cols-3"><MetricTile label="Registry keys" value={definitions.length} /><MetricTile label="Database permissions" value={dbPermissionCount} /><MetricTile label="ADMIN defaults" value={enabledAdminKeys.size} /></div>
    {definitions.length === 0 ? <OperationalPanel><p className="eo-table-empty" role="status">System permission definitions are not available.</p></OperationalPanel> : Object.entries(definitionGroups).map(([category, permissions]) => <OperationalPanel key={category} title={category} description="Stable permission identifiers shown for review; their enforcement remains server-side."><ul className="divide-y divide-[var(--eo-line-soft)]" aria-label={`${category} permissions`}>{permissions.map((permission) => <li className="flex items-start justify-between gap-4 py-3" key={permission.key}><div><p className="font-semibold">{permission.name}</p><code className="text-xs text-[var(--eo-text-muted)]">{permission.key}</code></div><ProtectedStatus label={enabledAdminKeys.has(permission.key) ? "ADMIN default" : "Explicit assignment"} tone={enabledAdminKeys.has(permission.key) ? "information" : "neutral"} /></li>)}</ul></OperationalPanel>)}
  </ProtectedPageFrame>;
}
