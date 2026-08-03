import type { Metadata } from "next";
import Link from "next/link";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listEmailLogs } from "@/lib/services/admin-email.service";
import { TestEmailForm } from "@/components/admin/TestEmailForm";
import { getEmailProviderName } from "@/lib/email/email-service";
import { formatRelativeDate } from "@/lib/utils/formatters";
import { EmailStatus } from "@/types/db";

export const metadata: Metadata = { title: "Emails" };

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: EmailStatus.PENDING, label: "Pending" },
  { value: EmailStatus.SENT, label: "Sent" },
  { value: EmailStatus.FAILED, label: "Failed" },
];

const STATUS_VARIANT: Record<string, "green" | "amber" | "red" | "slate"> = {
  SENT: "green",
  PENDING: "amber",
  FAILED: "red",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAdminPagePermission(PERMISSIONS.EMAILS_READ);

  const { status } = await searchParams;
  const providerName = getEmailProviderName();
  const isConsole = providerName === "console";

  const { data: logs, total } = await listEmailLogs({
    status: status as EmailStatus | undefined,
    page: 1,
    pageSize: 100,
  });

  return (
    <div className="space-y-6">
      <ProtectedPageHeader
        eyebrow="Communications"
        title="Email Logs"
        description={`${total} email record${total !== 1 ? "s" : ""} in the database.`}
      />

      {/* Provider status notice */}
      {isConsole ? (
        <div className="bg-[var(--kt-amber-wash)] border border-[rgba(245,158,11,0.22)] rounded-2xl px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-[var(--kt-solar-amber)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-[var(--kt-ink-navy)]">Console provider active</p>
            <p className="text-sm text-[var(--kt-text-muted)] mt-0.5">
              Email provider is not configured. Emails are logged to the database but will not be delivered.
              Set <code className="font-mono text-xs bg-white/60 px-1 py-0.5 rounded border border-[var(--kt-soft-border)]">RESEND_API_KEY</code> to enable real delivery.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--kt-mint-wash)] border border-[rgba(5,150,105,0.18)] rounded-2xl px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-[var(--kt-teal-emerald)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-[var(--kt-ink-navy)]">
            Email provider: <strong>{providerName}</strong> — real delivery is active.
          </p>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/emails?status=${f.value}` : "/admin/emails"}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              (status ?? "") === f.value
                ? "bg-[var(--kt-signal-cobalt)] text-white shadow-sm"
                : "border border-[var(--kt-soft-border)] text-[var(--kt-text-muted)] hover:border-[var(--kt-signal-cobalt)] hover:text-[var(--kt-signal-cobalt)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Logs table */}
      {logs.length === 0 ? (
        <EmptyState
          title="No email logs"
          description="Email records will appear here as transactional emails are triggered."
        />
      ) : (
        <AdministrationPanel padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--kt-soft-border)] bg-[var(--kt-cool-gray)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide">Recipient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide hidden sm:table-cell">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide hidden md:table-cell">Template</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--kt-border]">
                {logs.map((log) => (
                  <tr key={log.id} className="bg-[var(--kt-studio-white)] hover:bg-[var(--kt-cool-gray)] transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/emails/${log.id}`}
                        className="text-[var(--kt-signal-cobalt)] hover:underline truncate max-w-[180px] block"
                      >
                        {log.recipient}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--kt-text-muted)] hidden sm:table-cell truncate max-w-[220px]">{log.subject}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[log.status] ?? "slate"}>
                        {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--kt-text-muted)] hidden md:table-cell text-xs font-mono">
                      {log.templateType ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--kt-text-muted)] hidden lg:table-cell">
                      {formatRelativeDate(log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdministrationPanel>
      )}

      {/* Test email */}
      <AdministrationPanel>
        <h2 className="text-sm font-bold text-[var(--kt-ink-navy)] font-extrabold mb-1">Send test email</h2>
        <p className="text-xs text-[var(--kt-text-muted)] mb-4">
          Sends a test Welcome email to verify your provider configuration. The send will be logged.
        </p>
        <TestEmailForm defaultRecipient={user.email} />
      </AdministrationPanel>
    </div>
  );
}
