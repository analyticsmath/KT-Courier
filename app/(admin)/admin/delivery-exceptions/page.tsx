import type { Metadata } from "next";
import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDeliveryExceptions } from "@/lib/services/admin-delivery-exceptions.service";
import { formatDateTime } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Delivery Exceptions" };

function orderStatusPresentation(status: string) {
  const statuses: Record<string, { label: string; tone: "success" | "information" | "warning" | "danger" }> = {
    DELIVERED: { label: "Delivered", tone: "success" },
    COMPLETED: { label: "Completed", tone: "success" },
    IN_TRANSIT: { label: "In transit", tone: "information" },
    DELIVERY_ATTEMPTED: { label: "Delivery attempted", tone: "warning" },
    FAILED: { label: "Failed", tone: "danger" },
    CANCELLED: { label: "Cancelled", tone: "danger" },
  };
  return statuses[status] ?? { label: "Status unavailable", tone: "neutral" as const };
}

function exceptionPresentation(eventType: string) {
  const statuses: Record<string, { label: string; tone: "warning" | "danger" }> = {
    DELIVERY_ATTEMPTED: { label: "Delivery attempted", tone: "warning" },
    DELIVERY_FAILED: { label: "Delivery failed", tone: "danger" },
  };
  return statuses[eventType] ?? { label: "Exception update unavailable", tone: "neutral" as const };
}

export default async function AdminDeliveryExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; eventType?: string }>;
}) {
  await requireAdminPagePermission(PERMISSIONS.DISPATCH_READ);

  const { page: pageParam, eventType } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const pageSize = 25;

  const { data: exceptions, total } = await listDeliveryExceptions({
    page,
    pageSize,
    eventType: eventType ?? undefined,
  });

  const totalPages = Math.ceil(total / pageSize);
  const base = "/admin/delivery-exceptions";

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Operations"
        title="Delivery Exceptions"
        description="Orders where delivery was attempted or failed. Review and take action."
        actions={<Link className="eo-button eo-button--secondary" href="/admin/orders">All orders</Link>}
      />

      <nav aria-label="Delivery exception filters" className="flex flex-wrap items-center gap-2">
        <Link
          href={base}
          aria-current={!eventType ? "page" : undefined}
          className="eo-button eo-button--secondary"
        >
          All
        </Link>
        <Link
          href={`${base}?eventType=DELIVERY_ATTEMPTED`}
          aria-current={eventType === "DELIVERY_ATTEMPTED" ? "page" : undefined}
          className="eo-button eo-button--secondary"
        >
          Attempted
        </Link>
        <Link
          href={`${base}?eventType=DELIVERY_FAILED`}
          aria-current={eventType === "DELIVERY_FAILED" ? "page" : undefined}
          className="eo-button eo-button--secondary"
        >
          Failed
        </Link>
        <span className="ml-auto text-sm text-[var(--eo-text-secondary)]" role="status">
          {total} exception{total !== 1 ? "s" : ""}
        </span>
      </nav>

      {exceptions.length === 0 ? (
        <ProtectedState kind="empty" title="No delivery exceptions" description="Delivery exceptions will appear here when drivers record attempted or failed deliveries." />
      ) : (
        <OperationalPanel>
          <EditorialTable
            caption="Delivery exception records"
            mobileMode="stack"
            rows={exceptions}
            columns={[
              { id: "order", header: "Order", priority: "primary", cell: (exception) => <Link className="eo-text-link font-mono" href={`/admin/orders/${exception.orderId}`}>{exception.orderNumber}</Link> },
              { id: "delivery", header: "Delivery state", cell: (exception) => { const state = orderStatusPresentation(exception.orderStatus); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
              { id: "exception", header: "Exception", cell: (exception) => { const state = exceptionPresentation(exception.eventType); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
              { id: "reason", header: "Reason", priority: "secondary", cell: (exception) => exception.exceptionReasonLabel ?? "No safe reason recorded" },
              { id: "driver", header: "Driver", priority: "secondary", cell: (exception) => exception.driverDisplayName ?? exception.driverCode ?? "Unassigned" },
              { id: "region", header: "Region", priority: "optional", cell: (exception) => exception.deliveryRegionName ?? "Not recorded" },
              { id: "recorded", header: "Recorded", priority: "optional", cell: (exception) => formatDateTime(exception.occurredAt) },
            ]}
          />
        </OperationalPanel>
      )}

      {totalPages > 1 && (
        <nav aria-label="Delivery exception pages" className="flex flex-wrap items-center justify-center gap-3">
          {page > 1 && (
            <Link
              href={`${base}?page=${page - 1}${eventType ? `&eventType=${eventType}` : ""}`}
              className="eo-button eo-button--secondary"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-[var(--eo-text-secondary)]" aria-current="page">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`${base}?page=${page + 1}${eventType ? `&eventType=${eventType}` : ""}`}
              className="eo-button eo-button--secondary"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </ProtectedPageFrame>
  );
}
