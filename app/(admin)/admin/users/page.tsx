import type { Metadata } from "next";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus, type ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getUserStatusConfig } from "@/lib/constants/statuses";
import { listUsers } from "@/lib/services/admin-users.service";
import { formatDateTime } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Customer administration" };
function tone(variant: string): ProtectedStatusTone { return variant === "green" ? "success" : variant === "amber" ? "warning" : variant === "red" ? "danger" : variant === "blue" ? "information" : "neutral"; }

export default async function AdminUsersPage() {
  await requireAdminPagePermission(PERMISSIONS.USERS_READ);
  const { data: users, total } = await listUsers({ page: 1, pageSize: 100 });
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="People and network" title="Customer administration" description={`${total} authorized user account${total === 1 ? "" : "s"}. Customer detail and account-state workflows have no dedicated administrative route in the current route tree.`} /><OperationalPanel title="Authorized account directory" description="Only safe account context is included in this list; no session, password, or impersonation access is available."><EditorialTable caption="Customer administration directory" mobileMode="stack" rows={users} emptyState={<ProtectedState kind="empty" title="No accounts are available" description="No account record matches the existing list authority." />} columns={[
    { id: "identity", header: "Account", priority: "primary", cell: (user) => <div><strong>{user.name ?? "Name unavailable"}</strong><small>{user.email}</small></div> },
    { id: "role", header: "Account type", priority: "secondary", cell: (user) => user.role.replaceAll("_", " ") },
    { id: "state", header: "Account state", priority: "primary", cell: (user) => { const state = getUserStatusConfig(user.status); return <ProtectedStatus label={state.label} tone={tone(state.variant)} />; } },
    { id: "created", header: "Created", priority: "secondary", cell: (user) => <time>{formatDateTime(user.createdAt)}</time> },
  ]} /></OperationalPanel></ProtectedPageFrame>;
}
