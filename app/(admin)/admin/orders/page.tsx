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
import { listCourierPaymentReadiness } from "@/lib/services/courier-payment-readiness.service";
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
  const paymentReadiness = await listCourierPaymentReadiness(orders.map((order) => order.id));
  const rows = orders.map((order) => ({ ...order, financialStatus: paymentReadiness.get(order.id) }));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters = Number(Boolean(filters.status)) + Number(Boolean(assignmentFilter)) + Number(Boolean(search));

  return <ProtectedPageFrame className="eo-orders-page">
    <ProtectedPageHeader eyebrow="Operations" title="Courier orders" description={`${total.toLocaleString("en-ZA")} courier order${total === 1 ? "" : "s"} in this view. Review fulfillment, assignment and delivery progress.`} actions={<Link className="eo-inline-action" href="/admin/dispatch">Dispatch queue</Link>} />
    <ProtectedFilterBar activeFilterCount={activeFilters} clearHref={activeFilters ? "/admin/orders" : undefined}>
      <form action="/admin/orders" className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
        <label className="eo-filter-label" htmlFor="admin-order-status">Order status<select id="admin-order-status" name="status" defaultValue={filters.status??""}>{ADMIN_STATUS_FILTER_OPTIONS.map(filter=><option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
        <label className="eo-filter-label" htmlFor="admin-order-assignment">Assignment<select id="admin-order-assignment" name="assignmentFilter" defaultValue={assignmentFilter??""}>{ASSIGNMENT_FILTERS.map(filter=><option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
        <label className="eo-filter-label" htmlFor="admin-order-search">Search orders<input id="admin-order-search" name="search" defaultValue={search} placeholder="Reference, account, store, or city" /></label>
        <button className="eo-filter-submit" type="submit">Search</button>
      </form>
    </ProtectedFilterBar>
    <OperationalPanel title="Order directory" description="Select an order reference to review its complete delivery record.">
      <EditorialTable
        caption="Courier order queue"
        mobileMode="stack"
        rows={rows}
        emptyState={<ProtectedState kind="empty" title="No courier orders match this view" description="Try a different reference, status, or assignment filter." illustration={<RouteQueueIllustration />} />}
        columns={[
          { id: "reference", header: "Order", priority: "primary", cell: (order) => <div className="eo-order-reference"><Link className="eo-table-link" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link><small>{order.pickupCity ?? "Pickup unavailable"} → {order.dropoffCity ?? "Destination unavailable"}</small></div> },
          { id: "status", header: "Operational status", priority: "primary", cell: (order) => { const state = presentOrderStatus(order.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
          { id: "payment", header: "Payment", priority: "secondary", cell: (order) => {
            const state = order.financialStatus;
            return state ? <ProtectedStatus
              label={state.status === "PAID" ? "Paid" : state.status === "DEPOSIT_PAID_CASH_DUE" ? "Deposit paid · cash due" : state.status === "CASH_DUE_ON_DELIVERY" ? "Cash on delivery" : state.status === "RECONCILIATION_REQUIRED" ? "Reconcile payment" : state.status === "PAYMENT_REQUIRED" ? "Payment required" : "Unknown"}
              tone={state.status === "PAID" ? "success" : ["DEPOSIT_PAID_CASH_DUE", "CASH_DUE_ON_DELIVERY"].includes(state.status) ? "information" : "warning"}
            /> : <ProtectedStatus label="Unknown" tone="warning" />;
          } },
          { id: "assignment", header: "Assignment", priority: "secondary", cell: (order) => { const state = order.activeAssignment ? presentAssignmentStatus(order.activeAssignment.status) : { label: "Unassigned", tone: "warning" as const }; return <div><ProtectedStatus label={state.label} tone={state.tone} />{order.activeAssignment ? <small>{order.activeAssignment.driverDisplayName ?? order.activeAssignment.driverCode}</small> : null}</div>; } },
          { id: "account", header: "Account context", priority: "secondary", cell: (order) => order.storeName ?? order.customerName ?? "Account unavailable" },
          { id: "region", header: "Service region", priority: "optional", cell: (order) => order.deliveryRegionName ?? "Not matched" },
          { id: "created", header: "Created", priority: "secondary", cell: (order) => <time>{formatDateTime(order.createdAt)}</time> },
        ]}
      />
    </OperationalPanel>
    <ProtectedPagination currentPage={page} pageCount={pageCount} hrefForPage={(nextPage) => buildHref({ status: filters.status, assignmentFilter, search, page: nextPage })} />
  </ProtectedPageFrame>;
}
