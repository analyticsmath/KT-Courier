import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { Badge } from "@/components/ui/Badge";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getEmailLogById } from "@/lib/services/email-log.service";
import { formatDateTime } from "@/lib/utils/formatters";
import { EmailStatus } from "@/types/db";

export const metadata: Metadata = { title: "Email Log" };

const STATUS_VARIANT: Record<EmailStatus, "green" | "amber" | "red"> = {
  [EmailStatus.SENT]: "green",
  [EmailStatus.PENDING]: "amber",
  [EmailStatus.FAILED]: "red",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--kt-soft-border)] last:border-0">
      <span className="text-sm text-[var(--kt-text-muted)] w-40 flex-shrink-0">{label}</span>
      <span className="text-sm text-[var(--kt-ink-navy)] flex-1 break-all">{value ?? "—"}</span>
    </div>
  );
}

export default async function EmailLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPagePermission(PERMISSIONS.EMAILS_READ);

  const { id } = await params;
  const log = await getEmailLogById(id);
  if (!log) notFound();

  const fmtDate = (d: Date | string | null) =>
    d ? formatDateTime(d instanceof Date ? d.toISOString() : d) : "—";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-[var(--kt-text-muted)]">
        <Link href="/admin/emails" className="hover:text-[var(--kt-signal-cobalt)] transition-colors">
          Email Logs
        </Link>
        <span>/</span>
        <span className="text-[var(--kt-ink-navy)] font-mono text-xs">{log.id.slice(0, 12)}…</span>
      </div>

      <ProtectedPageHeader
        eyebrow="Email"
        title="Email log detail"
        description={log.subject}
      />

      <AdministrationPanel>
        <Row label="Status" value={
          <Badge variant={STATUS_VARIANT[log.status]}>
            {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
          </Badge>
        } />
        <Row label="Recipient" value={log.recipient} />
        <Row label="Subject" value={log.subject} />
        <Row label="Template" value={<span className="font-mono text-xs">{log.templateType}</span>} />
        <Row label="Created" value={fmtDate(log.createdAt)} />
        <Row label="Sent at" value={fmtDate(log.sentAt)} />
        <Row label="Provider ID" value={
          log.providerMessageId
            ? <span className="font-mono text-xs">{log.providerMessageId}</span>
            : null
        } />
        {log.errorMessage && (
          <Row label="Error" value={
            <span className="text-[var(--kt-signal-red)] text-xs">{log.errorMessage}</span>
          } />
        )}
        <Row label="Related user" value={
          log.relatedUserId
            ? <Link href={`/admin/users/${log.relatedUserId}`} className="text-[var(--kt-signal-cobalt)] hover:underline font-mono text-xs">{log.relatedUserId}</Link>
            : null
        } />
        <Row label="Related order" value={
          log.relatedOrderId
            ? <Link href={`/admin/orders/${log.relatedOrderId}`} className="text-[var(--kt-signal-cobalt)] hover:underline font-mono text-xs">{log.relatedOrderId}</Link>
            : null
        } />
      </AdministrationPanel>
    </div>
  );
}
