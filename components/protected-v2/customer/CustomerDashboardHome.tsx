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
  StaticActivityChart,
  StaticDonutChart,
  type DonutItem,
} from "@/components/protected-v2/dashboard";
import { ProtectedIcon } from "@/components/protected-v2/icons/ProtectedIcon";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { formatCustomerDateTime, getCustomerOrderStatus } from "@/lib/customer-presentation/customer-order-presentation";
import type { OrderSummaryDto } from "@/lib/dto/order.dto";
import type { CountInsight, DashboardPeriod } from "@/lib/dashboard-insights/types";
import type { CustomerDashboardBreakdown } from "@/lib/dashboard-insights/customer-dashboard-insights";
import styles from "../dashboard/dashboard.module.css";

export interface CustomerDashboardHomeProps {
  firstName: string;
  latestActive: OrderSummaryDto | null;
  recentOrders: readonly OrderSummaryDto[];
  activeCount: number;
  attentionCount: number;
  insight: CountInsight;
  breakdown: CustomerDashboardBreakdown;
  period: DashboardPeriod;
}

export function CustomerDashboardHome({
  firstName,
  latestActive,
  recentOrders,
  activeCount,
  attentionCount,
  insight,
  breakdown,
  period,
}: CustomerDashboardHomeProps) {
  const comparison = insight.comparison;

  const statusDonutItems: DonutItem[] = [
    { key: "active", label: "Active in transit", value: breakdown.active, color: "var(--dash-green)" },
    { key: "completed", label: "Completed", value: breakdown.completed, color: "var(--dash-teal)" },
    { key: "attention", label: "Needs attention", value: breakdown.attention, color: "var(--dash-orange)" },
    { key: "closed", label: "Cancelled / closed", value: breakdown.closed, color: "var(--dash-muted)" },
  ];

  const activeStatus = latestActive ? getCustomerOrderStatus(latestActive.status) : null;
  const scheduledFor = latestActive ? formatCustomerDateTime(latestActive.scheduledFor) : null;

  return (
    <DashboardCanvas>
      <DashboardHeader
        eyebrow="My delivery desk"
        title={`Welcome back, ${firstName}`}
        description="See the delivery that needs your attention, track active parcels, and start your next request."
        actions={
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/account/request-delivery">
            Request delivery
          </Link>
        }
      />

      <div className={styles.customerDashboardLayout}>
      {/* Mobile order prioritises delivery context and analysis before shortcuts. */}
      <DashboardGrid className={styles.customerFocusGroup} ariaLabel="Active delivery focus">
        <DashboardCol span={12}>
          {latestActive && activeStatus ? (
            <DashboardCard
              tone="surface"
              eyebrow="Active courier run"
              title={
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-lg font-bold tracking-tight">{latestActive.orderNumber}</span>
                  <ProtectedStatus label={activeStatus.label} tone={activeStatus.tone} />
                </div>
              }
              description={`Updated ${formatCustomerDateTime(latestActive.updatedAt) ?? "recently"}`}
              action={
                <Link
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                  href={`/account/orders/${latestActive.id}`}
                >
                  View delivery
                </Link>
              }
              padding="normal"
            >
              <div className="flex flex-col gap-4">
                <p className="text-sm text-[var(--dash-ink-secondary)] leading-relaxed m-0">
                  {activeStatus.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--dash-surface)] border border-[var(--dash-line)]">
                  <div>
                    <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--dash-muted)]">
                      Pickup origin
                    </span>
                    <span className="text-sm font-semibold text-[var(--dash-ink)] mt-0.5 block">
                      {latestActive.pickupSummary}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--dash-muted)]">
                      Dropoff destination
                    </span>
                    <span className="text-sm font-semibold text-[var(--dash-ink)] mt-0.5 block">
                      {latestActive.dropoffSummary}
                    </span>
                  </div>
                </div>

                {scheduledFor && (
                  <div className="text-xs text-[var(--dash-muted)]">
                    Scheduled collection: <strong className="text-[var(--dash-ink)]">{scheduledFor}</strong>
                  </div>
                )}
              </div>
            </DashboardCard>
          ) : (
            <DashboardCard
              tone="surface"
              eyebrow="Ready for delivery"
              title="No active parcels in flight"
              description="Your active delivery will appear here once you send a courier request."
              padding="normal"
            >
              <div className="flex flex-col sm:flex-row items-center gap-5 py-2">
                <DashboardIllustrationAsset role="customer" className="sm:max-w-[160px]" />
                <div className="flex flex-col gap-3 text-center sm:text-left">
                  <p className="text-sm text-[var(--dash-ink-secondary)] m-0">
                    Book point-to-point courier delivery across active service regions with live status tracking.
                  </p>
                  <div>
                    <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/account/request-delivery">
                      Request delivery
                    </Link>
                  </div>
                </div>
              </div>
            </DashboardCard>
          )}
        </DashboardCol>
      </DashboardGrid>

      <DashboardGrid className={styles.customerMetricsGroup} ariaLabel="Customer delivery metrics">
        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Active deliveries"
            value={activeCount}
            description="Parcels currently in flight"
            href="/account/orders"
            tone="surface"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Needs attention"
            value={attentionCount}
            description="Pending or delivery attempts"
            href="/account/orders"
            tone="surface"
            badge={
              attentionCount > 0 ? (
                <span className={`${styles.chip} ${styles.chipWarning}`}>Action required</span>
              ) : undefined
            }
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Period delivery requests"
            value={comparison.current}
            changePercent={comparison.changePercent}
            direction={comparison.direction}
            previousValue={comparison.previous}
            description={insight.periodLabel}
            tone="surface"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Total deliveries"
            value={breakdown.total}
            description="Lifetime customer requests"
            href="/account/orders"
            tone="surface"
          />
        </DashboardCol>
      </DashboardGrid>

      <DashboardGrid className={styles.customerAnalyticsGroup} ariaLabel="Customer delivery analytics">
        <DashboardCol span={7}>
          <DashboardCard
            eyebrow="Activity trend"
            title={insight.title}
            description={`${insight.definition} · ${insight.periodLabel}`}
            action={<DashboardPeriodControl period={period} href="/account" ariaLabel="Filter delivery request period" />}
            padding="normal"
          >
            {insight.seriesUnavailable ? (
              <p role="status" className={styles.emptyStateDesc}>
                Total is available. Activity detail exceeds display limits for this window; choose a shorter period.
              </p>
            ) : insight.buckets.some((b) => b.value > 0) ? (
              <StaticActivityChart
                buckets={insight.buckets}
                label={`${insight.title} · ${insight.periodLabel}`}
                tone="brand"
                heroValue={comparison.current}
                comparisonText={
                  comparison.changePercent !== null
                    ? `${comparison.changePercent > 0 ? "+" : ""}${comparison.changePercent.toFixed(1)}% vs prior period`
                    : undefined
                }
              />
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>No recorded delivery activity</p>
                <p className={styles.emptyStateDesc}>
                  No delivery requests were created in this period. Choose another window to review earlier requests.
                </p>
              </div>
            )}
          </DashboardCard>
        </DashboardCol>

        <DashboardCol span={5}>
          <DashboardCard
            eyebrow="Delivery lifecycle"
            title="Delivery status mix"
            description="Authoritative customer status distribution"
            padding="normal"
          >
            {breakdown.total > 0 ? (
              <StaticDonutChart
                items={statusDonutItems}
                title="Delivery status mix"
                centerValue={breakdown.total}
                centerLabel="Total parcels"
                layout="row"
              />
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>No deliveries recorded</p>
                <p className={styles.emptyStateDesc}>Your delivery status distribution will appear here once you submit a request.</p>
              </div>
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      <DashboardGrid className={styles.customerServicesGroup} ariaLabel="Customer account services">
        <DashboardCol span={12}>
          <DashboardCard
            tone="dark"
            eyebrow="Quick access"
            title="Account services"
            description="Manage your delivery preferences"
            padding="normal"
          >
            <div className={styles.quickAccessList}>
              <Link className={`${styles.btn} ${styles.btnDark} justify-start`} href="/account/addresses">
                <ProtectedIcon className={styles.quickAccessIcon} name="map" />
                <span>Saved addresses</span>
              </Link>
              <Link className={`${styles.btn} ${styles.btnDark} justify-start`} href="/account/wallet">
                <ProtectedIcon className={styles.quickAccessIcon} name="wallet" />
                <span>Customer wallet</span>
              </Link>
              <Link className={`${styles.btn} ${styles.btnDark} justify-start`} href="/account/notifications">
                <ProtectedIcon className={styles.quickAccessIcon} name="bell" />
                <span>Notifications</span>
              </Link>
              <Link className={`${styles.btn} ${styles.btnDark} justify-start`} href="/account/support">
                <ProtectedIcon className={styles.quickAccessIcon} name="support" />
                <span>Support and help</span>
              </Link>
            </div>
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      <DashboardGrid className={styles.customerRecordsGroup} ariaLabel="Recent delivery records">
        <DashboardCol span={12}>
          <DashboardCard
            eyebrow="Order history"
            title="Recent deliveries"
            description="Your five most recently requested deliveries"
            action={
              recentOrders.length > 0 ? (
                <Link className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} href="/account/orders">
                  View all deliveries
                </Link>
              ) : undefined
            }
            padding="normal"
          >
            {recentOrders.length > 0 ? (
              <ul className={styles.recordList}>
                {recentOrders.map((order) => {
                  const status = getCustomerOrderStatus(order.status);
                  return (
                    <li key={order.id} className={styles.recordItem}>
                      <div className={styles.recordLeading}>
                        <Link className={styles.recordTitle} href={`/account/orders/${order.id}`}>
                          {order.orderNumber}
                        </Link>
                        <span className={styles.recordSub}>
                          {order.pickupCity ?? order.pickupSummary} → {order.dropoffCity ?? order.dropoffSummary}
                        </span>
                        <span className={styles.recordTime}>
                          Updated {formatCustomerDateTime(order.updatedAt) ?? "—"}
                        </span>
                      </div>
                      <div className={styles.recordTrailing}>
                        <ProtectedStatus label={status.label} tone={status.tone} />
                        <Link
                          className={`${styles.btn} ${styles.btnQuiet} ${styles.btnSm}`}
                          href={`/account/orders/${order.id}`}
                        >
                          Details
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>No recent delivery records</p>
                <p className={styles.emptyStateDesc}>You haven&apos;t requested any deliveries yet. Start your first delivery above.</p>
              </div>
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>
      </div>
    </DashboardCanvas>
  );
}
