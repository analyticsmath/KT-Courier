import type { Metadata } from "next";
import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { presentAssignmentStatus } from "@/lib/admin-presentation/operational-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getDispatchBoardData } from "@/lib/services/admin-dispatch.service";
import { formatDateTime } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Dispatch queue" };

export default async function AdminDispatchPage() {
  await requireAdminPagePermission(PERMISSIONS.DISPATCH_READ);
  const data = await getDispatchBoardData();
  const eligibleCount = data.eligibleDrivers.recommended.length + data.eligibleDrivers.available.length;

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Operations" title="Dispatch queue" description="A server-backed queue for unassigned and active courier assignments. No map is required for these operations." actions={<Link className="eo-inline-action" href="/admin/orders">Courier orders</Link>} />
    <div className="grid gap-3 sm:grid-cols-3"><MetricTile label="Unassigned" value={data.counts.unassigned} description="DIRECT_AUTHORITY · assignable orders without active assignment" /><MetricTile label="Active assignments" value={data.counts.assigned} description="DIRECT_AUTHORITY · current active assignment records" /><MetricTile label="Eligible drivers" value={eligibleCount} description="DIRECT_AUTHORITY · existing dispatch eligibility projection" /></div>
    <ProtectedContentGrid contextRail={<OperationalPanel title="Map state" tone="subtle"><ProtectedStatus label="Map not required" tone="neutral" /><p className="eo-panel-copy">Dispatch remains usable through order, region, and eligible-driver context. Exact driver location is not shown.</p></OperationalPanel>}>
      <div className="grid gap-5">
        <OperationalPanel title="Unassigned orders" description="Open an order to use its region-specific canonical eligible-driver projection.">
          <EditorialTable caption="Unassigned courier orders" mobileMode="stack" rows={data.unassignedOrders} emptyState={<ProtectedState kind="empty" title="No orders await dispatch" description="All currently assignable orders have an active assignment." illustration={<RouteQueueIllustration />} />} columns={[
            { id: "order", header: "Order", priority: "primary", cell: (order) => <div><Link className="eo-table-link" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link><small>{order.pickupCity ?? "Pickup unavailable"} → {order.dropoffCity ?? "Destination unavailable"}</small></div> },
            { id: "region", header: "Region", priority: "secondary", cell: (order) => order.deliveryRegionName ?? "Not matched" },
            { id: "created", header: "Created", priority: "secondary", cell: (order) => <time>{formatDateTime(order.createdAt)}</time> },
            { id: "action", header: "", priority: "optional", cell: (order) => <Link className="eo-table-action" href={`/admin/orders/${order.id}`}>Review dispatch<span className="sr-only"> for {order.orderNumber}</span></Link> },
          ]} />
        </OperationalPanel>
        <OperationalPanel title="Active assignments" description="Assignment and order detail remain dedicated routes; reassignment is never drag-and-drop.">
          <EditorialTable caption="Active courier assignments" mobileMode="stack" rows={data.assignedOrders} emptyState={<ProtectedState kind="empty" title="No active assignments" description="No assignment record is currently active." />} columns={[
            { id: "order", header: "Order", priority: "primary", cell: (assignment) => <Link className="eo-table-link" href={`/admin/orders/${assignment.orderId}`}>{assignment.orderNumber}</Link> },
            { id: "assignment", header: "Assignment", priority: "primary", cell: (assignment) => { const state = presentAssignmentStatus(assignment.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
            { id: "driver", header: "Driver", priority: "secondary", cell: (assignment) => assignment.driverDisplayName ?? assignment.driverCode },
            { id: "route", header: "Route", priority: "optional", cell: (assignment) => `${assignment.pickupCity ?? "Pickup unavailable"} → ${assignment.dropoffCity ?? "Destination unavailable"}` },
            { id: "assigned", header: "Assigned", priority: "secondary", cell: (assignment) => <time>{formatDateTime(assignment.assignedAt)}</time> },
          ]} />
        </OperationalPanel>
      </div>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
