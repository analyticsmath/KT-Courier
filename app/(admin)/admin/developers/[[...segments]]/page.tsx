import { DeveloperAdministrationUnavailable } from "@/components/protected-v2/developer-admin/DeveloperAdministrationUnavailable";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const developerReadPermission: Record<string, (typeof PERMISSIONS)[keyof typeof PERMISSIONS]> = {
  applications: PERMISSIONS.DEVELOPER_APPLICATION_READ,
  scopes: PERMISSIONS.DEVELOPER_SCOPE_READ,
  credentials: PERMISSIONS.DEVELOPER_CREDENTIAL_AUDIT_READ,
  usage: PERMISSIONS.DEVELOPER_API_USAGE_READ,
  requests: PERMISSIONS.DEVELOPER_API_REQUEST_AUDIT_READ,
  webhooks: PERMISSIONS.DEVELOPER_WEBHOOK_READ,
  "webhook-deliveries": PERMISSIONS.DEVELOPER_WEBHOOK_DELIVERY_READ,
  reconciliation: PERMISSIONS.DEVELOPER_RECONCILIATION_READ,
};

export default async function AdminDevelopersPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const segments = (await params).segments ?? [];
  await requireAdminPagePermission(developerReadPermission[segments[0] ?? ""] ?? PERMISSIONS.DEVELOPER_APPLICATION_READ);
  return <DeveloperAdministrationUnavailable segments={segments} />;
}
