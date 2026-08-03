import type { Metadata } from "next";
import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedFilterBar, ProtectedPagination } from "@/components/protected-v2/data/FilterAndPagination";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { presentAssignmentStatus, presentOrderStatus } from "@/lib/admin-presentation/operational-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ADMIN_STATUS_FILTER_OPTIONS } from "@/lib/constants/order-status";
import { listOrdersWithAssignmentState } from "@/lib/services/admin-dispatch.service";
import { formatDateTime } from "@/lib/utils/formatters";
import { OrderStatus } from "@/types/db";

export const metadata: Metadata = { title: "Courier orders" };

const PAGE_SIZE = 25;
const ASSIGNMENT_FILTERS = [
  { value: "", label: "All assignments" },
  { value: "unassigned", label: "Unassigned" },
  { value: "assigned", label: "Assigned" },
] as const;

function buildHref(input: { status?: string; assignmentFilter?: string; search?: string; page?: number }) {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.assignmentFilter) params.set("assignmentFilter", input.assignmentFilter);
  if (input.search) params.set("search", input.search);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignmentFilter?: string; search?: string; page?: string }>;
}) {
  await requireAdminPagePermission(PERMISSIONS.ORDERS_READ);
  const filters = await searchParams;
  const page = Math.max(1, Number(filters.page) || 1);
  const search = filters.search?.trim().slice(0, 80) || "";
  const assignmentFilter = filters.assignmentFilter === "assigned" || filters.assignmentFilter === "unassigned" ? filters.assignmentFilter : undefined;
  const { data: orders, total } = await listOrdersWithAssignmentState({
    status: filters.status as OrderStatus | undefined,
    assignmentFilter,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters = Number(Boolean(filters.status)) + Number(Boolean(assignmentFilter)) + Number(Boolean(search));

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Operations" title="Courier orders" description={`${total} source-backed courier order${total === 1 ? "" : "s"}.`} actions={<Link className="eo-inline-action" href="/admin/dispatch">Dispatch queue</Link>} />
    <ProtectedFilterBar activeFilterCount={activeFilters} clearHref={activeFilters ? "/admin/orders" : undefined}>
      <form action="/admin/orders" className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        {assignmentFilter ? <input type="hidden" name="assignmentFilter" value={assignmentFilter} /> : null}
        <label className="eo-filter-label" htmlFor="admin-order-search">Search orders<input id="admin-order-search" name="search" defaultValue={search} placeholder="Reference, account, store, or city" /></label>
        <button className="eo-filter-submit" type="submit">Search</button>
      </form>
    </ProtectedFilterBar>
    <div className="eo-filter-chips" aria-label="Order status filters">
      {ADMIN_STATUS_FILTER_OPTIONS.map((filter) => <Link aria-current={(filters.status ?? "") === filter.value ? "page" : undefined} className={(filters.status ?? "") === filter.value ? "is-active" : undefined} href={buildHref({ status: filter.value || undefined, assignmentFilter, search })} key={filter.value}>{filter.label}</Link>)}
    </div>
    <div className="eo-filter-chips" aria-label="Assignment state filters">
      {ASSIGNMENT_FILTERS.map((filter) => <Link aria-current={(assignmentFilter ?? "") === filter.value ? "page" : undefined} className={(assignmentFilter ?? "") === filter.value ? "is-active" : undefined} href={buildHref({ status: filters.status, assignmentFilter: filter.value || undefined, search })} key={filter.value}>{filter.label}</Link>)}
    </div>
    <OperationalPanel title="Order queue" description="Filters and pagination are resolved by the server. Selection always opens the dedicated order route.">
      <EditorialTable
        caption="Courier order queue"
        mobileMode="stack"
        rows={orders}
        emptyState={<ProtectedState kind="empty" title="No courier orders match this view" description="Adjust or clear the current server-backed filters." illustration={<RouteQueueIllustration />} />}
        columns={[
          { id: "reference", header: "Order", priority: "primary", cell: (order) => <div><Link className="eo-table-link" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link><small>{order.pickupCity ?? "Pickup unavailable"} → {order.dropoffCity ?? "Destination unavailable"}</small></div> },
          { id: "status", header: "Operational status", priority: "primary", cell: (order) => { const state = presentOrderStatus(order.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
          { id: "assignment", header: "Assignment", priority: "secondary", cell: (order) => { const state = order.activeAssignment ? presentAssignmentStatus(order.activeAssignment.status) : { label: "Unassigned", tone: "warning" as const }; return <div><ProtectedStatus label={state.label} tone={state.tone} />{order.activeAssignment ? <small>{order.activeAssignment.driverDisplayName ?? order.activeAssignment.driverCode}</small> : null}</div>; } },
          { id: "account", header: "Account context", priority: "secondary", cell: (order) => order.storeName ?? order.customerName ?? "Account unavailable" },
          { id: "region", header: "Service region", priority: "optional", cell: (order) => order.deliveryRegionName ?? "Not matched" },
          { id: "created", header: "Created", priority: "secondary", cell: (order) => <time>{formatDateTime(order.createdAt)}</time> },
          { id: "action", header: "", priority: "optional", cell: (order) => <Link className="eo-table-action" href={`/admin/orders/${order.id}`}>Open<span className="sr-only"> {order.orderNumber}</span></Link> },
        ]}
      />
    </OperationalPanel>
    <ProtectedPagination currentPage={page} pageCount={pageCount} hrefForPage={(nextPage) => buildHref({ status: filters.status, assignmentFilter, search, page: nextPage })} />
  </ProtectedPageFrame>;
}
