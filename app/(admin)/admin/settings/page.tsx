import type { Metadata } from "next";
import { SettingsManager } from "@/components/admin/SettingsManager";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listSettings } from "@/lib/services/admin-settings.service";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdminPagePermission(PERMISSIONS.SETTINGS_READ);
  const settings = await listSettings();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Governance" title="Settings" description="Only canonical allowlisted platform configuration is available through the existing server authority." />
    <OperationalPanel title="Platform settings" description="Credentials, environment variables, and production-control secrets are not rendered.">{settings.length ? <SettingsManager settings={settings} /> : <p className="eo-table-empty" role="status">No settings are configured.</p>}</OperationalPanel>
  </ProtectedPageFrame>;
}
