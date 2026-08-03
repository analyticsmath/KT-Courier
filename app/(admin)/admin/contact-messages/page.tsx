import type { Metadata } from "next";
import Link from "next/link";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listContactMessages } from "@/lib/services/admin-contact.service";
import { formatRelativeDate } from "@/lib/utils/formatters";
import { ContactMessageStatus } from "@/types/db";

export const metadata: Metadata = { title: "Contact Messages" };

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: ContactMessageStatus.NEW, label: "New" },
  { value: ContactMessageStatus.READ, label: "Read" },
  { value: ContactMessageStatus.RESPONDED, label: "Responded" },
  { value: ContactMessageStatus.ARCHIVED, label: "Archived" },
];

const STATUS_VARIANT: Record<ContactMessageStatus, "blue" | "green" | "amber" | "slate"> = {
  [ContactMessageStatus.NEW]: "blue",
  [ContactMessageStatus.READ]: "amber",
  [ContactMessageStatus.RESPONDED]: "green",
  [ContactMessageStatus.ARCHIVED]: "slate",
};

export default async function AdminContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminPagePermission(PERMISSIONS.CONTACTS_READ);

  const { status } = await searchParams;
  const { data: messages, total } = await listContactMessages({
    status: status as ContactMessageStatus | undefined,
    page: 1,
    pageSize: 100,
  });

  return (
    <div className="space-y-6">
      <ProtectedPageHeader
        eyebrow="Inbox"
        title="Contact Messages"
        description={`${total} message${total !== 1 ? "s" : ""} from the contact form.`}
      />

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/contact-messages?status=${f.value}` : "/admin/contact-messages"}
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

      {messages.length === 0 ? (
        <EmptyState title="No messages" description="No contact form submissions match this filter." />
      ) : (
        <AdministrationPanel padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--kt-soft-border)] bg-[var(--kt-cool-gray)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide">From</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide hidden sm:table-cell">Enquiry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide hidden md:table-cell">Preview</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide hidden lg:table-cell">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kt-soft-border)]">
                {messages.map((msg) => (
                  <tr key={msg.id} className="bg-[var(--kt-studio-white)] hover:bg-[var(--kt-cool-gray)] transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/contact-messages/${msg.id}`}
                        className="font-semibold text-[var(--kt-signal-cobalt)] hover:underline"
                      >
                        {msg.name}
                      </Link>
                      <p className="text-xs text-[var(--kt-text-muted)]">{msg.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--kt-text-muted)] hidden sm:table-cell">
                      {msg.enquiryType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-[var(--kt-text-muted)] hidden md:table-cell truncate max-w-[240px]">
                      {msg.messageSummary}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[msg.status]}>
                        {msg.status.charAt(0) + msg.status.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--kt-text-muted)] hidden lg:table-cell">
                      {formatRelativeDate(msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdministrationPanel>
      )}
    </div>
  );
}
