import Link from "next/link";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { presentOrderStatus } from "@/lib/admin-presentation/operational-status";
import { formatDateTime } from "@/lib/utils/formatters";
import type { AdminDashboardData } from "@/lib/services/admin-dashboard.service";
import type { DispatchBoardData } from "@/lib/services/admin-dispatch.service";
import styles from "./admin-pages.module.css";

type ExceptionRecord = {
  id: string;
  orderId: string;
  orderNumber: string;
  occurredAt: Date;
  label: string;
  source: "pickup" | "delivery";
};

export function AdminCommandCentre({
  dashboard,
  dispatch,
  exceptionCount,
  recentExceptions,
}: {
  dashboard: AdminDashboardData;
  dispatch: DispatchBoardData;
  exceptionCount: number;
  recentExceptions: readonly ExceptionRecord[];
}) {
  const attention = [...dashboard.ordersNeedingAttention]
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    .slice(0, 7);

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Command centre"
        title="Operations desk"
        description="A source-backed triage view for courier operations, network review, and commerce controls."
        actions={<Link className={styles.actionLink} href="/admin/orders">Review orders</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Unassigned dispatch" value={dispatch.counts.unassigned} description="DIRECT_AUTHORITY · assignable orders without an active assignment" />
        <MetricTile label="Operational exceptions" value={exceptionCount} description="DIRECT_AUTHORITY · recorded pickup and delivery exceptions" />
        <MetricTile label="Stores awaiting review" value={dashboard.stats.pendingStores} description="DIRECT_AUTHORITY · current pending store state" />
        <MetricTile label="Orders needing review" value={dashboard.stats.pendingOrders + dashboard.stats.failedOrders} description="DERIVABLE_SERVER_SIDE · pending plus failed order states" />
      </div>

      <ProtectedContentGrid
        contextRail={
          <>
            <OperationalPanel title="Operational context" description="Current configuration and source limits.">
              <dl className={styles.definitionList}>
                <div><dt>Active regions</dt><dd>{dashboard.stats.activeDeliveryRegions}</dd></div>
                <div><dt>Pricing rules active</dt><dd>{dashboard.stats.pricingRulesActive}</dd></div>
                <div><dt>Map support</dt><dd><ProtectedStatus label="Location data without map" tone="neutral" /></dd></div>
              </dl>
            </OperationalPanel>
            <OperationalPanel title="Next workspaces" tone="subtle">
              <ul className={styles.linkList}>
                <li><Link href="/admin/dispatch">Dispatch queue</Link></li>
                <li><Link href="/admin/pickup-exceptions">Pickup exceptions</Link></li>
                <li><Link href="/admin/delivery-exceptions">Delivery exceptions</Link></li>
                <li><Link href="/admin/stores">Store review</Link></li>
              </ul>
            </OperationalPanel>
          </>
        }
      >
        <OperationalPanel
          title="Attention queue"
          description="Ordered by the repository’s stored creation time (oldest first), with a stable ID tie-breaker. No urgency score is derived."
          action={<Link className={styles.actionLink} href="/admin/orders">All courier orders</Link>}
        >
          {attention.length ? (
            <ol className={styles.recordList}>
              {attention.map((order) => {
                const state = presentOrderStatus(order.status);
                return <li key={order.id} className={styles.recordListItem}>
                  <div className="min-w-0"><Link href={`/admin/orders/${order.id}`} className={styles.recordListTitle}>{order.orderNumber}</Link><p>{order.pickupCity ?? "Pickup unavailable"} → {order.dropoffCity ?? "Destination unavailable"}</p><time>{formatDateTime(order.createdAt)}</time></div>
                  <ProtectedStatus label={state.label} tone={state.tone} />
                </li>;
              })}
            </ol>
          ) : <ProtectedState kind="empty" title="No orders need the configured review" description="The current attention projection is empty." illustration={<RouteQueueIllustration />} />}
        </OperationalPanel>

        <div className="grid gap-5 lg:grid-cols-2">
          <OperationalPanel title="Unassigned dispatch" description="Canonical eligible-driver selection remains available in the dispatch workspace." action={<Link className={styles.actionLink} href="/admin/dispatch">Open dispatch</Link>}>
            {dispatch.unassignedOrders.length ? <ol className={styles.recordList}>{dispatch.unassignedOrders.slice(0, 5).map((order) => <li key={order.id} className={styles.recordListItem}><div><Link className={styles.recordListTitle} href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link><p>{order.pickupCity ?? "Pickup unavailable"} → {order.dropoffCity ?? "Destination unavailable"}</p></div><ProtectedStatus label="Unassigned" tone="warning" /></li>)}</ol> : <p className={styles.emptyCopy} role="status">No assignable courier orders are unassigned.</p>}
          </OperationalPanel>
          <OperationalPanel title="Recent operational exceptions" description="Recorded event history only." action={<Link className={styles.actionLink} href="/admin/delivery-exceptions">Delivery exceptions</Link>}>
            {recentExceptions.length ? <ol className={styles.recordList}>{recentExceptions.map((exception) => <li key={exception.id} className={styles.recordListItem}><div><Link className={styles.recordListTitle} href={`/admin/orders/${exception.orderId}`}>{exception.orderNumber}</Link><p>{exception.label}</p><time>{formatDateTime(exception.occurredAt)}</time></div><ProtectedStatus label={exception.source === "pickup" ? "Pickup" : "Delivery"} tone="warning" /></li>)}</ol> : <p className={styles.emptyCopy} role="status">No recent pickup or delivery exceptions are recorded.</p>}
          </OperationalPanel>
        </div>
      </ProtectedContentGrid>
    </ProtectedPageFrame>
  );
}
