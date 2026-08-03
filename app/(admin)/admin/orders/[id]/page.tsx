import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminOrderStatusUpdate } from "@/components/admin/AdminOrderStatusUpdate";
import { AdminAssignmentActions } from "@/components/protected-v2/admin/AdminAssignmentActions";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { presentAssignmentStatus, presentOrderStatus } from "@/lib/admin-presentation/operational-status";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getAdminOrderDetail } from "@/lib/services/admin-orders.service";
import { getOrderActiveAssignment, getOrderAssignmentHistory } from "@/lib/services/admin-dispatch.service";
import { listEligibleDrivers } from "@/lib/services/driver-eligibility.service";
import { getOrderOperationalEvents } from "@/lib/services/admin-pickup-operations.service";
import { formatDateTime } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Courier order" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.ORDERS_READ);
  const { id } = await params;
  const order = await getAdminOrderDetail(id);
  if (!order) notFound();

  const [canManageStatus, canAssign, canReassign, activeAssignment, assignmentHistory, operationalEvents] = await Promise.all([
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.ORDERS_STATUS_MANAGE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.DISPATCH_ASSIGN }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.DISPATCH_REASSIGN }),
    getOrderActiveAssignment(id),
    getOrderAssignmentHistory(id),
    getOrderOperationalEvents(id),
  ]);
  const eligible = canAssign || canReassign ? await listEligibleDrivers(order.deliveryRegionId ?? null) : null;
  const candidates = eligible ? [...eligible.recommended, ...eligible.available].map((driver) => ({ id: driver.id, driverCode: driver.driverCode, displayName: driver.displayName })) : [];
  const orderState = presentOrderStatus(order.status);

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Courier order" title={order.orderNumber} description={`${order.deliveryType.replaceAll("_", " ")} · created ${formatDateTime(order.createdAt)}`} breadcrumbs={[{ label: "Orders", href: "/admin/orders" }, { label: order.orderNumber }]} actions={<Link className="eo-inline-action" href="/admin/orders">Back to queue</Link>} />
    <ProtectedContentGrid
      contextRail={<>
        <OperationalPanel title="Current status"><ProtectedStatus label={orderState.label} tone={orderState.tone} /><p className="eo-panel-copy">{orderState.description}</p></OperationalPanel>
        <OperationalPanel title="Administrative state" tone="subtle"><dl className="eo-definition-list"><div><dt>Source</dt><dd>{order.source}</dd></div><div><dt>Region</dt><dd>{order.deliveryRegionName ?? "Not matched"}</dd></div><div><dt>Scheduled</dt><dd>{order.scheduledFor ? formatDateTime(order.scheduledFor) : "Not scheduled"}</dd></div></dl></OperationalPanel>
      </>}
    >
      <div className="grid gap-5">
        <OperationalPanel title="Operational context" description="Customer and store identity is limited to the context needed to work this order.">
          <dl className="eo-detail-grid"><div><dt>Customer</dt><dd>{order.customer?.name ?? order.customer?.email ?? "Not attached"}</dd></div><div><dt>Store</dt><dd>{order.store?.name ?? "Not attached"}</dd></div><div><dt>Pickup</dt><dd>{order.pickupSummary}</dd></div><div><dt>Destination</dt><dd>{order.dropoffSummary}</dd></div><div><dt>Parcel</dt><dd>{order.parcelDescription ?? "No description"} · {order.parcelCount} parcel{order.parcelCount === 1 ? "" : "s"}</dd></div><div><dt>Estimate</dt><dd>{order.priceEstimate === null ? "Unavailable" : `${order.currency} ${order.priceEstimate.toFixed(2)}`}</dd></div></dl>
          {order.customerNote ? <p className="eo-internal-note"><strong>Customer note:</strong> {order.customerNote}</p> : null}
          {order.adminNote ? <p className="eo-internal-note"><strong>Internal note:</strong> {order.adminNote}</p> : null}
        </OperationalPanel>

        <OperationalPanel title="Assignment" description="Eligibility, region compatibility, availability, audit, and version conflicts remain server-authoritative.">
          {activeAssignment ? <div className="eo-assignment-summary"><div><strong>{activeAssignment.driverDisplayName ?? activeAssignment.driverCode}</strong><p>{activeAssignment.driverCode} · {activeAssignment.vehicleType ?? "Vehicle not recorded"}</p></div><ProtectedStatus {...(() => { const state = presentAssignmentStatus(activeAssignment.status); return { label: state.label, tone: state.tone }; })()} /></div> : <ProtectedState kind="unavailable" title="No active assignment" description="The order has no active assignment in the canonical dispatch projection." />}
          <div className="mt-4"><AdminAssignmentActions orderId={id} assignment={activeAssignment ? { id: activeAssignment.id, driverProfileId: activeAssignment.driverProfileId, version: activeAssignment.version } : null} candidates={candidates} canAssign={canAssign} canReassign={canReassign} /></div>
          {assignmentHistory.length ? <ActivityTimeline ariaLabel="Assignment history" items={assignmentHistory.map((assignment) => { const state = presentAssignmentStatus(assignment.status); return { id: assignment.id, title: `${assignment.driverDisplayName ?? assignment.driverCode} — ${state.label}`, description: assignment.cancellationReason ?? assignment.rejectionReason ?? undefined, timestamp: formatDateTime(assignment.assignedAt), tone: state.tone }; })} /> : null}
        </OperationalPanel>

        <OperationalPanel title="Administrative action" description="Only permissions resolved on the server are shown. State changes wait for canonical server confirmation.">
          {canManageStatus ? <AdminOrderStatusUpdate orderId={id} currentStatus={order.status} /> : <ProtectedState kind="restricted" title="Read-only operational access" description="This administrator can review the order but does not have the state-transition permission." />}
        </OperationalPanel>

        <OperationalPanel title="History" description="Chronological events from the existing order and operational event authorities.">
          <ActivityTimeline ariaLabel="Order status history" items={order.statusHistory.map((item) => { const state = presentOrderStatus(item.status); return { id: item.id, title: state.label, description: [item.note, item.internalNote ? `Internal: ${item.internalNote}` : null].filter(Boolean).join(" · ") || undefined, timestamp: formatDateTime(item.createdAt), tone: state.tone }; })} />
          {operationalEvents.length ? <ActivityTimeline ariaLabel="Operational event history" className="mt-5" items={operationalEvents.map((event) => ({ id: event.id, title: event.eventType.replaceAll("_", " "), description: event.publicNote ?? event.internalNote ?? undefined, timestamp: formatDateTime(event.occurredAt), tone: event.eventType.includes("FAILED") ? "warning" : "information" }))} /> : null}
        </OperationalPanel>
      </div>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
