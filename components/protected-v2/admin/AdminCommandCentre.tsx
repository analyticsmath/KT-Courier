import React from "react";
import Link from "next/link";
import Image from "next/image";
import studio from "./adminStudio.module.css";
import {
  DashboardCanvas,
  DashboardGrid,
  DashboardCol,
  DashboardCard,
  DashboardPeriodControl,
  StaticActivityChart,
} from "@/components/protected-v2/dashboard";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { presentOrderStatus } from "@/lib/admin-presentation/operational-status";
import { formatDateTime } from "@/lib/utils/formatters";
import type { AdminDesk } from "@/lib/dashboard-insights/admin-desk";
import type { DashboardPeriod } from "@/lib/dashboard-insights/types";
import styles from "../dashboard/dashboard.module.css";

export function AdminCommandCentre({
  desk,
  period,
}: {
  desk: AdminDesk;
  period: DashboardPeriod;
}) {
  const insight = desk.insight;
  const comparison = insight?.comparison;

  const totalDispatchOrders = desk.dispatch
    ? desk.dispatch.counts.assigned + desk.dispatch.counts.unassigned
    : 0;

  return (
    <DashboardCanvas>
      <header className={studio.pageHeading}>
        <div>
          <h1>Operations overview</h1>
          <p>Deliveries, dispatch and the work that needs your attention.</p>
        </div>
        {desk.ordersAllowed ? <Link className={studio.primaryAction} href="/admin/orders">View courier orders</Link> : null}
      </header>

      <section className={studio.overview} aria-label="Operations overview">
        <div className={studio.volume}>
          <div className={studio.volumeHeading}>
            <h2>Courier activity</h2>
            <DashboardPeriodControl period={period} href="/admin" ariaLabel="Filter courier volume period" />
          </div>
          {insight ? <>
            <div className={studio.volumeValue}>
              <strong>{comparison ? comparison.current.toLocaleString("en-ZA") : "Unavailable"}</strong>
              <span>courier orders<br />{insight.periodLabel}</span>
            </div>
            {insight.seriesUnavailable ? <p>Activity detail exceeds display limits. Choose a shorter period.</p> : insight.buckets.some((b) => b.value > 0) ? (
              <StaticActivityChart buckets={insight.buckets} label={`${insight.title} · ${insight.periodLabel}`} tone="brand" />
            ) : <div className={studio.quietState}><p>No orders recorded in this period.</p><span>Choose another period to review earlier activity.</span></div>}
            <p className={studio.volumeNote}>Courier orders by creation date. Marketplace orders excluded.</p>
          </> : <ProtectedState kind="restricted" title="Activity data restricted" description="Your role does not have access to aggregated order metrics." />}
        </div>
        <aside className={studio.dispatchSummary}>
          <div className={studio.dispatchHeading}>
            <h2>Dispatch workload</h2>
            <Image src="/media/dashboard/delivery-truck.webp" alt="" width={160} height={130} sizes="130px" priority />
          </div>
          <div className={studio.dispatchTotal}><strong>{desk.dispatch ? totalDispatchOrders : "Unavailable"}</strong><span>active courier runs</span></div>
          {desk.dispatch ? <>
            <dl className={studio.dispatchBreakdown}>
              <div><dt>Assigned in transit</dt><dd>{desk.dispatch.counts.assigned}</dd></div>
              <div><dt>Waiting for assignment</dt><dd>{desk.dispatch.counts.unassigned}</dd></div>
            </dl>
            <Link className={studio.lightAction} href="/admin/dispatch">Open dispatch board</Link>
          </> : <p>Dispatch access is restricted for this account.</p>}
        </aside>
      </section>

      <section className={studio.actionStrip} aria-label="Immediate action summary">
        {desk.pendingStores !== null ? <Link href="/admin/stores"><strong>{desk.pendingStores}</strong><span>Stores awaiting review<small>Business details and account approval</small></span></Link> : null}
        {desk.ordersAllowed && desk.attention ? <Link href="/admin/orders"><strong>{desk.attention.length}</strong><span>Orders in review list<small>Oldest requests and unresolved routes</small></span></Link> : null}
        <div><strong>{desk.exceptionCount ?? "Unavailable"}</strong><span>Recorded exceptions<small>Pickup and delivery event history</small></span></div>
      </section>

      {/* Row 2: Attention Queue (7 cols) + Network Coverage & Context (5 cols) */}
      <DashboardGrid ariaLabel="Operational queues and network context">
        <DashboardCol span={7}>
          <DashboardCard
            className={studio.reviewPanel}
            title="Attention queue"
            description="Oldest requests needing manual administrative review or missing a recorded route."
            action={
              desk.attention && desk.attention.length > 0 ? (
                <Link className={`${styles.btn} ${styles.btnQuiet} ${styles.btnSm}`} href="/admin/orders">
                  View all ({desk.attention.length})
                </Link>
              ) : undefined
            }
            padding="normal"
          >
            {desk.attention ? (
              desk.attention.length > 0 ? (
                <div className={styles.queueTableWrap}>
                  <table className={styles.queueTable}>
                    <caption className="sr-only">Orders requiring administrative attention</caption>
                    <thead>
                      <tr><th scope="col">Order</th><th scope="col">Route</th><th scope="col">Requested</th><th scope="col">Status</th></tr>
                    </thead>
                    <tbody>
                      {desk.attention.map((row) => {
                        const status = presentOrderStatus(row.status);
                        return (
                          <tr key={row.id}>
                            <td><Link className={styles.queueReference} href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link></td>
                            <td className={styles.queueRoute}>{row.pickupAddress?.city ?? "Pickup unavailable"} → {row.dropoffAddress?.city ?? "Destination unavailable"}</td>
                            <td className={styles.queueDate}>{formatDateTime(row.createdAt)}</td>
                            <td className={styles.queueStatus}><ProtectedStatus label={status.label} tone={status.tone} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateTitle}>Queue clear</p>
                  <p className={styles.emptyStateDesc}>No orders currently require immediate administrative review.</p>
                </div>
              )
            ) : (
              <ProtectedState
                kind="restricted"
                title="Order access restricted"
                description="Choose a permitted workspace from navigation."
              />
            )}
          </DashboardCard>
        </DashboardCol>

        <DashboardCol span={5}>
          <DashboardCard
            title="Service coverage"
            description="Active regional courier zones"
            action={
              desk.regions ? (
                <Link className={`${styles.btn} ${styles.btnQuiet} ${styles.btnSm}`} href="/admin/regions">
                  All regions
                </Link>
              ) : undefined
            }
            padding="normal"
          >

            {desk.regions ? (
              <div className={styles.coveragePanel}>
                <div className={studio.coverageVisual}>
                  <Image src="/media/dashboard/merchant-handoff.webp" alt="Merchant handing over a shipment" width={420} height={180} sizes="(max-width: 768px) 100vw, 350px" loading="lazy" />
                  <span>Local delivery network</span>
                </div>
                <div className={styles.coverageSummary}>
                  <span className={styles.coverageNumber}>{desk.regions.length.toLocaleString("en-ZA")}</span>
                  <span className={styles.coverageDescriptor}>Active service {desk.regions.length === 1 ? "region" : "regions"}</span>
                </div>
                <ul className={styles.coverageList} aria-label="Active service regions">
                  {desk.regions.slice(0, 8).map((region) => (
                    <li className={styles.coverageItem} key={region.id}>
                      <span className={styles.coverageName} title={region.name}>{region.name}</span>
                      <span className={styles.coverageCity}>{region.city}</span>
                    </li>
                  ))}
                </ul>
                {desk.regions.length > 8 ? (
                  <p className={styles.coverageRemainder}>
                    {desk.regions.length - 8} more {desk.regions.length - 8 === 1 ? "region" : "regions"} in the regional directory
                  </p>
                ) : null}
              </div>
            ) : (
              <p className={styles.emptyStateDesc}>Regional coverage data unavailable.</p>
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* Row 3: Dispatch Queue (7 cols) + Recent Exceptions (5 cols) */}
      <DashboardGrid ariaLabel="Secondary queues and event logs">
        <DashboardCol span={7}>
          <DashboardCard
            title="Dispatch assignable queue"
            description="Active orders ready for driver allocation"
            action={
              desk.dispatch && desk.dispatch.unassignedOrders.length > 0 ? (
                <Link className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} href="/admin/dispatch">
                  Dispatch orders ({desk.dispatch.unassignedOrders.length})
                </Link>
              ) : undefined
            }
            padding="normal"
          >
            {desk.dispatch ? (
              desk.dispatch.unassignedOrders.length > 0 ? (
                <div className={styles.queueTableWrap}>
                  <table className={styles.queueTable}>
                    <caption className="sr-only">Orders waiting for driver assignment</caption>
                    <thead><tr><th scope="col">Order</th><th scope="col">Delivery route</th><th scope="col">Dispatch</th></tr></thead>
                    <tbody>
                      {desk.dispatch.unassignedOrders.slice(0, 5).map((row) => (
                        <tr key={row.id}>
                          <td>
                            {desk.ordersAllowed ? (
                              <Link className={styles.queueReference} href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link>
                            ) : (
                              <span className={styles.queueReference}>{row.orderNumber}</span>
                            )}
                          </td>
                          <td className={styles.queueRoute}>{row.pickupCity ?? "Pickup"} → {row.dropoffCity ?? "Destination"}</td>
                          <td className={styles.queueStatus}><ProtectedStatus label="Awaiting assignment" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateTitle}>No unassigned orders</p>
                  <p className={styles.emptyStateDesc}>All active courier orders are currently assigned or completed.</p>
                </div>
              )
            ) : (
              <p className={styles.emptyStateDesc}>Dispatch data restricted.</p>
            )}
          </DashboardCard>
        </DashboardCol>

        <DashboardCol span={5}>
          <DashboardCard
            title="Recent exceptions"
            description="Pickup & delivery failure logs"
            action={
              desk.exceptions && desk.exceptions.length > 0 ? (
                <Link className={`${styles.btn} ${styles.btnQuiet} ${styles.btnSm}`} href="/admin/delivery-exceptions">
                  Full log
                </Link>
              ) : undefined
            }
            padding="normal"
          >
            {desk.exceptions && desk.exceptions.length > 0 ? (
              <div className={styles.queueTableWrap}>
                <table className={styles.queueTable}>
                  <caption className="sr-only">Most recent delivery exceptions</caption>
                  <thead><tr><th scope="col">Order</th><th scope="col">Issue</th><th scope="col">Recorded</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {desk.exceptions.slice(0, 5).map((row) => (
                      <tr key={row.id}>
                        <td>
                          {desk.ordersAllowed ? (
                            <Link className={styles.queueReference} href={`/admin/orders/${row.orderId}`}>{row.orderNumber}</Link>
                          ) : (
                            <span className={styles.queueReference}>{row.orderNumber}</span>
                          )}
                        </td>
                        <td className={styles.queueRoute}>{row.label}</td>
                        <td className={styles.queueDate}>{formatDateTime(row.occurredAt)}</td>
                        <td className={styles.queueStatus}><ProtectedStatus label="Exception recorded" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>No recent exceptions</p>
                <p className={styles.emptyStateDesc}>No pickup or delivery failures recorded within the recent log window.</p>
              </div>
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>
    </DashboardCanvas>
  );
}
