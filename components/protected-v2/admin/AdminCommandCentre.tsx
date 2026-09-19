import React from "react";
import Link from "next/link";
import {
  DashboardCanvas,
  DashboardGrid,
  DashboardCol,
  DashboardCard,
  DashboardMetricCard,
  DashboardHeader,
  DashboardIllustrationAsset,
  DashboardPeriodControl,
  StaticBarChart,
  StaticDonutChart,
  type DonutItem,
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

  // Build authoritative dispatch distribution items (Assigned vs Unassigned only)
  const dispatchItems: DonutItem[] = desk.dispatch
    ? [
        {
          key: "assigned",
          label: "Assigned in transit",
          value: desk.dispatch.counts.assigned,
          color: "var(--dash-green)",
        },
        {
          key: "unassigned",
          label: "Unassigned queue",
          value: desk.dispatch.counts.unassigned,
          color: "var(--dash-brand)",
        },
      ]
    : [];

  const totalDispatchOrders = desk.dispatch
    ? desk.dispatch.counts.assigned + desk.dispatch.counts.unassigned
    : 0;

  return (
    <DashboardCanvas>
      <DashboardHeader
        eyebrow="Command centre"
        title="Operations desk"
        description="Authoritative network state, active dispatch balance, exception queues, and delivery coverage."
        actions={
          desk.ordersAllowed ? (
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/admin/orders">
              Review orders
            </Link>
          ) : undefined
        }
      />

      {/* KPI Metric Strip (Asymmetric 4-card band, 2-up on mobile) */}
      <DashboardGrid ariaLabel="Network operational metrics">
        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Courier order volume"
            value={comparison ? comparison.current : "—"}
            changePercent={comparison ? comparison.changePercent : null}
            direction={comparison ? comparison.direction : "unavailable"}
            previousValue={comparison ? comparison.previous : undefined}
            description={insight ? insight.periodLabel : "Network activity"}
            href={desk.ordersAllowed ? "/admin/orders" : undefined}
            tone="brand"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Unassigned dispatch"
            value={desk.dispatch ? desk.dispatch.counts.unassigned : "—"}
            description="Assignable courier orders"
            href={desk.dispatch ? "/admin/dispatch" : undefined}
            tone="dark"
            badge={
              desk.dispatch && desk.dispatch.counts.unassigned > 0 ? (
                <span className={`${styles.chip} ${styles.chipWarning}`}>Action required</span>
              ) : undefined
            }
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Recorded exceptions"
            value={desk.exceptionCount !== null ? desk.exceptionCount : "—"}
            description="Pickup & delivery event history"
            href={desk.dispatch ? "/admin/delivery-exceptions" : undefined}
            tone="surface"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Stores awaiting review"
            value={desk.pendingStores !== null ? desk.pendingStores : "—"}
            description="Pending merchant onboarding"
            href="/admin/stores"
            tone="surface"
          />
        </DashboardCol>
      </DashboardGrid>

      {/* Row 1: Primary Analytics (7 cols) + Dispatch Workload Balance (5 cols) */}
      <DashboardGrid ariaLabel="Primary operational analytics">
        <DashboardCol span={7}>
          {insight ? (
            <DashboardCard
              eyebrow="Activity trend"
              title={insight.title}
              description={`${insight.definition} · ${insight.periodLabel}`}
              action={<DashboardPeriodControl period={period} href="/admin" ariaLabel="Filter courier volume period" />}
              padding="normal"
            >
              {insight.seriesUnavailable ? (
                <p role="status" className={styles.emptyStateDesc}>
                  Total is available. Activity detail exceeds display limits for this window; choose a shorter period.
                </p>
              ) : insight.buckets.some((b) => b.value > 0) ? (
                <StaticBarChart
                  buckets={insight.buckets}
                  label={`${insight.title} · ${insight.periodLabel}`}
                  tone="brand"
                  heroValue={comparison ? comparison.current : undefined}
                  comparisonText={
                    comparison && comparison.changePercent !== null
                      ? `${comparison.changePercent > 0 ? "+" : ""}${comparison.changePercent.toFixed(1)}% vs prior period`
                      : undefined
                  }
                />
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateTitle}>No recorded activity</p>
                  <p className={styles.emptyStateDesc}>No courier orders recorded in this period. Choose another window to review.</p>
                </div>
              )}
            </DashboardCard>
          ) : (
            <DashboardCard eyebrow="Activity trend" title="Courier orders" padding="normal">
              <ProtectedState
                kind="restricted"
                title="Activity data restricted"
                description="Your administrative role does not have permission to view aggregated order metrics."
              />
            </DashboardCard>
          )}
        </DashboardCol>

        <DashboardCol span={5}>
          <DashboardCard
            eyebrow="Fleet balance"
            title="Dispatch active workload"
            description="Assignable vs assigned courier runs"
            action={
              desk.dispatch ? (
                <Link className={`${styles.btn} ${styles.btnQuiet} ${styles.btnSm}`} href="/admin/dispatch">
                  Open board
                </Link>
              ) : undefined
            }
            padding="normal"
          >
            {desk.dispatch ? (
              totalDispatchOrders > 0 ? (
                <StaticDonutChart
                  items={dispatchItems}
                  title="Dispatch active workload"
                  centerValue={totalDispatchOrders}
                  centerLabel="Active runs"
                  layout="row"
                />
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateTitle}>No active dispatch orders</p>
                  <p className={styles.emptyStateDesc}>There are currently no assigned or unassigned orders in the active dispatch board.</p>
                </div>
              )
            ) : (
              <ProtectedState
                kind="restricted"
                title="Dispatch data restricted"
                description="Administrative dispatch permissions are required to view live dispatch counts."
              />
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* Row 2: Attention Queue (7 cols) + Network Coverage & Context (5 cols) */}
      <DashboardGrid ariaLabel="Operational queues and network context">
        <DashboardCol span={7}>
          <DashboardCard
            eyebrow="Prioritised review"
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
                <ul className={styles.recordList}>
                  {desk.attention.map((row) => {
                    const status = presentOrderStatus(row.status);
                    return (
                      <li key={row.id} className={styles.recordItem}>
                        <div className={styles.recordLeading}>
                          <Link className={styles.recordTitle} href={`/admin/orders/${row.id}`}>
                            {row.orderNumber}
                          </Link>
                          <span className={styles.recordSub}>
                            {row.pickupAddress?.city ?? "Pickup unavailable"} → {row.dropoffAddress?.city ?? "Destination unavailable"}
                          </span>
                          <span className={styles.recordTime}>{formatDateTime(row.createdAt)}</span>
                        </div>
                        <div className={styles.recordTrailing}>
                          <ProtectedStatus label={status.label} tone={status.tone} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
            eyebrow="Regional network"
            title="Service coverage"
            description="Active regional courier zones"
            action={
              desk.regions ? (
                <Link className={`${styles.btn} ${styles.btnQuiet} ${styles.btnSm}`} href="/admin/delivery-regions">
                  All regions
                </Link>
              ) : undefined
            }
            padding="normal"
          >
            <div className="flex flex-col gap-3">
              <DashboardIllustrationAsset role="admin" />
              {desk.regions ? (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {desk.regions.map((region) => (
                    <span
                      key={region.id}
                      className={`${styles.chip} ${styles.chipNeutral}`}
                      title={`${region.name} (${region.city})`}
                    >
                      <span className={styles.chipDot} />
                      {region.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyStateDesc}>Regional coverage data unavailable.</p>
              )}
            </div>
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* Row 3: Dispatch Queue (7 cols) + Recent Exceptions (5 cols) */}
      <DashboardGrid ariaLabel="Secondary queues and event logs">
        <DashboardCol span={7}>
          <DashboardCard
            eyebrow="Ready to dispatch"
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
                <ul className={styles.recordList}>
                  {desk.dispatch.unassignedOrders.slice(0, 5).map((row) => (
                    <li key={row.id} className={styles.recordItem}>
                      <div className={styles.recordLeading}>
                        {desk.ordersAllowed ? (
                          <Link className={styles.recordTitle} href={`/admin/orders/${row.id}`}>
                            {row.orderNumber}
                          </Link>
                        ) : (
                          <span className={styles.recordTitle}>{row.orderNumber}</span>
                        )}
                        <span className={styles.recordSub}>
                          {row.pickupCity ?? "Pickup"} → {row.dropoffCity ?? "Destination"}
                        </span>
                      </div>
                      <div className={styles.recordTrailing}>
                        <span className={`${styles.chip} ${styles.chipWarning}`}>
                          <span className={styles.chipDot} />
                          Unassigned
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
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
            eyebrow="Audit trail"
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
              <ul className={styles.recordList}>
                {desk.exceptions.slice(0, 5).map((row) => (
                  <li key={row.id} className={styles.recordItem}>
                    <div className={styles.recordLeading}>
                      {desk.ordersAllowed ? (
                        <Link className={styles.recordTitle} href={`/admin/orders/${row.orderId}`}>
                          {row.orderNumber}
                        </Link>
                      ) : (
                        <span className={styles.recordTitle}>{row.orderNumber}</span>
                      )}
                      <span className={styles.recordSub}>{row.label}</span>
                      <span className={styles.recordTime}>{formatDateTime(row.occurredAt)}</span>
                    </div>
                    <div className={styles.recordTrailing}>
                      <span className={`${styles.chip} ${styles.chipDanger}`}>
                        <span className={styles.chipDot} />
                        Exception
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
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
