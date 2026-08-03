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
import { listPickupExceptions } from "@/lib/services/admin-pickup-operations.service";
import { PICKUP_FAILURE_REASON_LABELS } from "@/lib/constants/pickup";
import { formatDateTime } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Pickup Exceptions" };

export default async function AdminPickupExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminPagePermission(PERMISSIONS.DISPATCH_READ);

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const pageSize = 25;

  const { data: exceptions, total } = await listPickupExceptions({ page, pageSize });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Operations"
        title="Pickup Exceptions"
        description="Orders where pickup could not be completed. Review and take action."
        actions={<Link className="eo-button eo-button--secondary" href="/admin/orders">All orders</Link>}
      />

      <OperationalPanel title="Recorded pickup failures" padding="compact"><p className="m-0 text-sm text-[var(--eo-text-secondary)]" role="status">{total} pickup failure{total !== 1 ? "s" : ""} recorded.</p></OperationalPanel>

      {exceptions.length === 0 ? (
        <ProtectedState kind="empty" title="No pickup exceptions" description="Pickup exceptions will appear here when drivers record a failed pickup." />
      ) : (
        <OperationalPanel>
          <EditorialTable
            caption="Pickup exception records"
            mobileMode="stack"
            rows={exceptions}
            columns={[
              { id: "order", header: "Order", priority: "primary", cell: (exception) => <Link className="eo-text-link font-mono" href={`/admin/orders/${exception.orderId}`}>{exception.orderNumber}</Link> },
              { id: "status", header: "Pickup state", cell: () => <ProtectedStatus label="Pickup failed" tone="danger" /> },
              { id: "reason", header: "Reason", cell: (exception) => exception.failureReason ? PICKUP_FAILURE_REASON_LABELS[exception.failureReason] ?? "Reason unavailable" : "No safe reason recorded" },
              { id: "driver", header: "Driver", priority: "secondary", cell: (exception) => exception.driverDisplayName ?? exception.driverCode ?? "Unassigned" },
              { id: "region", header: "Region", priority: "secondary", cell: (exception) => exception.deliveryRegionName ?? "Not recorded" },
              { id: "recorded", header: "Recorded", priority: "optional", cell: (exception) => formatDateTime(exception.occurredAt) },
            ]}
          />
        </OperationalPanel>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pickup exception pages" className="flex flex-wrap items-center justify-center gap-3">
          {page > 1 && (
            <Link
              href={`/admin/pickup-exceptions?page=${page - 1}`}
              className="eo-button eo-button--secondary"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-[var(--eo-text-secondary)]" aria-current="page">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/pickup-exceptions?page=${page + 1}`}
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
