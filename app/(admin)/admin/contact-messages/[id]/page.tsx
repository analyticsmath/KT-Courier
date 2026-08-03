import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { Badge } from "@/components/ui/Badge";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getContactMessage } from "@/lib/services/admin-contact.service";
import { ContactMessageStatusUpdate } from "@/components/admin/ContactMessageStatusUpdate";
import { formatDateTime } from "@/lib/utils/formatters";
import { ContactMessageStatus } from "@/types/db";

export const metadata: Metadata = { title: "Contact Message" };

const STATUS_VARIANT: Record<ContactMessageStatus, "blue" | "green" | "amber" | "slate"> = {
  [ContactMessageStatus.NEW]: "blue",
  [ContactMessageStatus.READ]: "amber",
  [ContactMessageStatus.RESPONDED]: "green",
  [ContactMessageStatus.ARCHIVED]: "slate",
};

export default async function AdminContactMessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPagePermission(PERMISSIONS.CONTACTS_READ);

  const { id } = await params;
  const message = await getContactMessage(id);
  if (!message) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-[var(--kt-text-muted)]">
        <Link href="/admin/contact-messages" className="hover:text-[var(--kt-signal-cobalt)] transition-colors">
          Contact Messages
        </Link>
        <span>/</span>
        <span className="text-[var(--kt-ink-navy)] font-semibold">{message.name}</span>
      </div>

      <ProtectedPageHeader
        eyebrow="Message"
        title={message.name}
        description={`${message.email}${message.phone ? " · " + message.phone : ""}`}
      />

      {/* Message details */}
      <AdministrationPanel>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[message.status]}>
              {message.status.charAt(0) + message.status.slice(1).toLowerCase()}
            </Badge>
            <span className="text-xs text-[var(--kt-text-muted)]">
              {formatDateTime(message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt))}
            </span>
          </div>
          <span className="text-xs text-[var(--kt-text-muted)] capitalize">
            {message.enquiryType.replace(/_/g, " ")}
          </span>
        </div>

        <div className="bg-[var(--kt-cool-gray)] rounded-xl px-4 py-4">
          <p className="text-sm text-[var(--kt-ink-navy)] whitespace-pre-wrap leading-relaxed">
            {message.message}
          </p>
        </div>

        {message.phone && (
          <p className="text-xs text-[var(--kt-text-muted)] mt-3">
            Phone: <span className="text-[var(--kt-ink-navy)] font-medium">{message.phone}</span>
          </p>
        )}
      </AdministrationPanel>

      {/* Status update */}
      <AdministrationPanel>
        <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-4">Update status</h2>
        <ContactMessageStatusUpdate
          messageId={message.id}
          currentStatus={message.status}
        />
      </AdministrationPanel>
    </div>
  );
}
