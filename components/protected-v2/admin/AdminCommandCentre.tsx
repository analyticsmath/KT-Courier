import Link from "next/link";
import { MetricTile, OperationalPanel } from "../surfaces/OperationalPanel";
import { ProtectedPageFrame, ProtectedContentGrid } from "../surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "../surfaces/ProtectedPageHeader";
import { ProtectedStatus } from "../feedback/ProtectedStatus";
import { ProtectedState } from "../feedback/ProtectedState";
import { IllustrationFrame } from "../illustrations/IllustrationFrame";
import { CountInsightPanel } from "../visualizations/CountInsightPanel";
import { presentOrderStatus } from "@/lib/admin-presentation/operational-status";
import { formatDateTime } from "@/lib/utils/formatters";
import type { AdminDesk } from "@/lib/dashboard-insights/admin-desk";
import type { DashboardPeriod } from "@/lib/dashboard-insights/types";
import styles from "./admin-pages.module.css";

export function AdminCommandCentre({ desk, period }: { desk: AdminDesk; period: DashboardPeriod }) {
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Command centre" title="Operations desk" description="Review the network, clear exceptions, and keep deliveries moving." actions={desk.ordersAllowed ? <Link className="eo-button eo-button--primary" href="/admin/orders">Review orders</Link> : undefined} />
    <div className="eo-metric-strip">
      {desk.dispatch ? <Link href="/admin/dispatch"><MetricTile label="Unassigned dispatch" value={desk.dispatch.counts.unassigned} description="Current assignable orders" /></Link> : null}
      {desk.exceptionCount !== null ? <Link href="/admin/delivery-exceptions"><MetricTile label="Recorded exceptions" value={desk.exceptionCount} description="Pickup and delivery event history" /></Link> : null}
      {desk.pendingStores !== null ? <Link href="/admin/stores"><MetricTile label="Stores awaiting review" value={desk.pendingStores} description="Current pending store state" /></Link> : null}
    </div>
    <ProtectedContentGrid contextRail={<>
      <IllustrationFrame role="admin" />
      {desk.regions ? <OperationalPanel title="Network coverage" description="Up to twelve active service regions." tone="subtle"><ul className={styles.recordList}>{desk.regions.map((region) => <li key={region.id} className={styles.recordListItem}><span>{region.name}</span><span>{region.city}</span></li>)}</ul></OperationalPanel> : null}
      {desk.dispatch ? <OperationalPanel title="Recent exceptions" description="Oldest first within recent recorded events.">{desk.exceptions.length ? <ol className={styles.recordList}>{desk.exceptions.map((row) => <li key={row.id} className={styles.recordListItem}><div>{desk.ordersAllowed ? <Link className={styles.recordListTitle} href={`/admin/orders/${row.orderId}`}>{row.orderNumber}</Link> : <strong>{row.orderNumber}</strong>}<p>{row.label}</p><time>{formatDateTime(row.occurredAt)}</time></div></li>)}</ol> : <p>No recent exceptions recorded.</p>}</OperationalPanel> : null}
    </>}>
      <div className="eo-dashboard-stack">
        {desk.attention ? <OperationalPanel className="eo-feature-card" title="Attention queue" description="Oldest requests needing review, including active requests without a recorded route.">{desk.attention.length ? <ol className={styles.recordList}>{desk.attention.map((row) => { const status = presentOrderStatus(row.status); return <li key={row.id} className={styles.recordListItem}><div><Link className={styles.recordListTitle} href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link><p>{row.pickupAddress?.city ?? "Pickup unavailable"} → {row.dropoffAddress?.city ?? "Destination unavailable"}</p><time>{formatDateTime(row.createdAt)}</time></div><ProtectedStatus label={status.label} tone={status.tone} /></li>; })}</ol> : <p>No orders need review.</p>}</OperationalPanel> : <ProtectedState kind="restricted" title="Choose a permitted workspace" description="Your navigation contains the workspaces available to this account." />}
        {desk.insight ? <CountInsightPanel insight={desk.insight} period={period} href="/admin" /> : null}
        {desk.dispatch ? <OperationalPanel title="Dispatch queue" action={<Link className={styles.actionLink} href="/admin/dispatch">Open dispatch</Link>}>{desk.dispatch.unassignedOrders.length ? <ol className={styles.recordList}>{desk.dispatch.unassignedOrders.slice(0, 5).map((row) => <li className={styles.recordListItem} key={row.id}><div><strong>{row.orderNumber}</strong><p>{row.pickupCity ?? "Pickup unavailable"} → {row.dropoffCity ?? "Destination unavailable"}</p></div><ProtectedStatus label="Unassigned" tone="warning" /></li>)}</ol> : <p>No assignable courier orders are unassigned.</p>}</OperationalPanel> : null}
      </div>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
