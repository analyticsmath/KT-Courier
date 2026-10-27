import type { Metadata } from "next";
import Link from "next/link";
import { DispatchDriverReadiness } from "@/components/admin/DispatchDriverReadiness";
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

  return <ProtectedPageFrame className="eo-dispatch-page">
    <ProtectedPageHeader eyebrow="Operations" title="Dispatch queue" description="Review unassigned orders, monitor active routes and resolve driver eligibility before allocating deliveries." actions={<Link className="eo-inline-action" href="/admin/orders">Courier orders</Link>} />
    <div className="eo-dispatch-metrics"><MetricTile className="eo-dispatch-metric--priority" label="Unassigned orders" value={data.counts.unassigned} description="Awaiting driver allocation" /><MetricTile label="Active assignments" value={data.counts.assigned} description="Currently allocated to drivers" /><MetricTile label="Eligible drivers" value={eligibleCount} description="Available and approved to dispatch" /></div>
    <ProtectedContentGrid contextRail={<div className="eo-dispatch-sidebar"><OperationalPanel title="Driver readiness" description="Eligibility and compliance checks"><DispatchDriverReadiness drivers={data.eligibleDrivers} /></OperationalPanel><OperationalPanel title="Driver location" tone="subtle"><p className="eo-panel-copy">Location is available on individual active orders after pickup. GPS does not override assignment and vehicle eligibility checks.</p></OperationalPanel></div>}>
      <div className="grid gap-5">
        <OperationalPanel accent="citrus" title="Ready for allocation" description="Open an order to review its route and eligible driver options.">
          <EditorialTable caption="Unassigned courier orders" mobileMode="stack" rows={data.unassignedOrders} emptyState={<ProtectedState kind="empty" title="No orders await dispatch" description="All currently assignable orders have an active assignment." illustration={<RouteQueueIllustration />} />} columns={[
            { id: "order", header: "Order", priority: "primary", cell: (order) => <div><Link className="eo-table-link" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link><small>{order.pickupCity ?? "Pickup unavailable"} → {order.dropoffCity ?? "Destination unavailable"}</small></div> },
            { id: "region", header: "Region", priority: "secondary", cell: (order) => order.deliveryRegionName ?? "Not matched" },
            { id: "routing", header: "Dispatch status", priority: "primary", cell: (order) => order.manualDispatchRequired ? (
              <div>
                <ProtectedStatus label={order.manualDispatchReason ?? "MANUAL_DISPATCH_REQUIRED"} tone="warning" />
                <small className="block text-xs text-muted-foreground mt-0.5">{order.manualDispatchLabel}</small>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">Standard queue</span>
            ) },
            { id: "created", header: "Created", priority: "secondary", cell: (order) => <time>{formatDateTime(order.createdAt)}</time> },
            { id: "action", header: "", priority: "optional", cell: (order) => <Link className="eo-table-action" href={`/admin/orders/${order.id}`}>Review<span className="sr-only"> dispatch for {order.orderNumber}</span></Link> },
          ]} />
        </OperationalPanel>
        <OperationalPanel title="Active deliveries" description="Live assignment records with driver and route details.">
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
