import type { Metadata } from "next";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listAdminActivity } from "@/lib/services/admin-activity.service";
import { formatRelativeDate } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Activity" };

export default async function AdminActivityPage() {
  await requireAdminPagePermission(PERMISSIONS.ACTIVITY_READ);
  const { data: logs, total } = await listAdminActivity({ page: 1, pageSize: 50 });
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Governance" title="Activity" description={`${total} administrative action${total !== 1 ? "s" : ""} on record.`} />
    <OperationalPanel title="Append-only activity" description="A bounded, chronological audit projection. It does not expose session data, stack traces, or unrelated private evidence.">
      {logs.length ? <ActivityTimeline ariaLabel="Administrative activity" items={logs.map((log) => ({ id: log.id, title: log.message ?? `${log.action} — ${log.entityType ?? "record"}`, description: [log.actor ? `Recorded by ${log.actor.name ?? log.actor.email}` : null, log.entityType ? `${log.entityType}${log.entityId ? `:${log.entityId.slice(0, 8)}` : ""}` : null].filter(Boolean).join(" · ") || undefined, timestamp: formatRelativeDate(log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt)), tone: log.action === "DELETE" ? "danger" : log.action === "CREATE" ? "success" : log.action === "STATUS_CHANGE" ? "warning" : "neutral" }))} /> : <p className="eo-table-empty" role="status">No administrative activity is available.</p>}
    </OperationalPanel>
  </ProtectedPageFrame>;
}
