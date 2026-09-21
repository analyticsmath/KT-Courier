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
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { StoreCourierOrderList, type StoreCourierOrderRecord } from "./StoreCourierOrderList";
import { StoreFulfilmentQueue as StoreFulfilmentQueueComponent } from "./StoreFulfilmentQueue";
import type { StoreFulfilmentQueue } from "@/lib/store-presentation/store-fulfilment-priority";
import { getStoreFulfilmentSummary } from "@/lib/store-presentation/store-fulfilment-priority";
import { storeAccountState } from "@/lib/store-presentation/store-status";
import type { CountInsight, DashboardPeriod } from "@/lib/dashboard-insights/types";
import styles from "../dashboard/dashboard.module.css";

export interface StoreOverviewPageProps {
  storeName: string;
  storeStatus: string | null;
  queue: StoreFulfilmentQueue;
  recentCourierOrders: readonly StoreCourierOrderRecord[];
  pickupConfigured: boolean;
  payableBalance: string | null;
  insight?: CountInsight | null;
  period?: DashboardPeriod;
  activity?: React.ReactNode;
}

export function StoreOverviewPage({
  storeName,
  storeStatus,
  queue,
  recentCourierOrders,
  pickupConfigured,
  payableBalance,
  insight,
  period = "7_DAYS",
  activity,
}: StoreOverviewPageProps) {
  const summary = getStoreFulfilmentSummary(queue);
  const state = storeAccountState(storeStatus);

  // Authoritative stage breakdown from full queue arrays
  const inPreparationCount = queue.preparing.length + queue.accepted.length;
  const readyCount = queue.readyForPickup.length;
  const handoffCount = queue.handoffInProgress.length;
  const attentionCount = summary.needsAttention;
  const collectedCount = queue.completedHandoff.length;
  const totalQueueOrders = inPreparationCount + readyCount + handoffCount + attentionCount + collectedCount;

  const stageMix: DonutItem[] = [
    { key: "prep", label: "In preparation", value: inPreparationCount, color: "var(--dash-teal)" },
    { key: "ready", label: "Ready for pickup", value: readyCount, color: "var(--dash-green)" },
    { key: "attention", label: "Needs attention", value: attentionCount, color: "var(--dash-orange)" },
    { key: "handoff", label: "Collection in progress", value: handoffCount, color: "var(--dash-brand)" },
    { key: "collected", label: "Collected orders", value: collectedCount, color: "var(--dash-muted)" },
  ];

  const comparison = insight?.comparison;

  return (
    <DashboardCanvas>
      <DashboardHeader
        eyebrow="Store operations"
        title={storeName}
        description="Marketplace fulfilment bench, confirmed store earnings, pickup point status, and merchant courier requests."
        actions={
          <div className="flex items-center gap-2">
            <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/store/profile">
              Store profile
            </Link>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/store/new-delivery">
              New delivery
            </Link>
          </div>
        }
      />

      {/* KPI Metric Strip (4-card band, 2-up on mobile) */}
      <DashboardGrid ariaLabel="Store operational summary">
        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Needs attention"
            value={summary.needsAttention}
            description="Review, customer action, or reconciliation"
            href="#fulfilment-bench"
            tone="surface"
            badge={
              summary.needsAttention > 0 ? (
                <span className={`${styles.chip} ${styles.chipWarning}`}>Action required</span>
              ) : undefined
            }
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Needs preparation"
            value={summary.needsPreparation}
            description="Accepted or currently preparing"
            href="#fulfilment-bench"
            tone="surface"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Ready for collection"
            value={summary.readyForCollection}
            description="Awaiting driver or customer pickup"
            href="#fulfilment-bench"
            tone="surface"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Confirmed balance"
            value={payableBalance !== null ? `ZAR ${payableBalance}` : "—"}
            description="Confirmed store earnings"
            href="/store/earnings"
            tone="dark"
          />
        </DashboardCol>
      </DashboardGrid>

      {/* Row 1: Primary Marketplace Fulfilment Bench (7 cols) + Stage Mix (5 cols) */}
      <DashboardGrid ariaLabel="Fulfilment operations">
        <DashboardCol span={7}>
          <div id="fulfilment-bench">
            <StoreFulfilmentQueueComponent queue={queue} limit={6} />
          </div>
        </DashboardCol>

        <DashboardCol span={5}>
          <DashboardCard
            eyebrow="Stage distribution"
            title="Fulfilment stage mix"
            description="Current marketplace order pipeline"
            padding="normal"
          >
            {totalQueueOrders > 0 ? (
              <StaticDonutChart
                items={stageMix}
                title="Fulfilment stage mix"
                centerValue={totalQueueOrders}
                centerLabel="Total queue"
                layout="row"
              />
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>Queue clear</p>
                <p className={styles.emptyStateDesc}>There are currently no active marketplace orders in the fulfilment queue.</p>
              </div>
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* Row 2: Marketplace Order Volume Analytics (7 cols) + Store Context (5 cols) */}
      <DashboardGrid ariaLabel="Order volume and collection point">
        <DashboardCol span={7}>
          {insight ? (
            <DashboardCard
              eyebrow="Marketplace telemetry"
              title={insight.title}
              description={`${insight.definition} · ${insight.periodLabel}`}
              action={<DashboardPeriodControl period={period} href="/store" ariaLabel="Filter marketplace order volume period" />}
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
                  heroValue={comparison ? comparison.current : undefined}
                  comparisonText={
                    comparison && comparison.changePercent !== null
                      ? `${comparison.changePercent > 0 ? "+" : ""}${comparison.changePercent.toFixed(1)}% vs prior period`
                      : undefined
                  }
                />
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateTitle}>No marketplace activity</p>
                  <p className={styles.emptyStateDesc}>No marketplace store orders recorded in this period.</p>
                </div>
              )}
            </DashboardCard>
          ) : activity ? (
            <DashboardCard eyebrow="Marketplace telemetry" title="Order activity" padding="normal">
              {activity}
            </DashboardCard>
          ) : (
            <DashboardCard eyebrow="Marketplace telemetry" title="Marketplace activity" padding="normal">
              <p className={styles.emptyStateDesc}>Telemetry unavailable.</p>
            </DashboardCard>
          )}
        </DashboardCol>

        <DashboardCol span={5}>
          <DashboardCard
            eyebrow="Operations context"
            title="Store readiness"
            description="Account state and pickup point"
            action={
              <Link className={`${styles.btn} ${styles.btnQuiet} ${styles.btnSm}`} href="/store/profile">
                Manage profile
              </Link>
            }
            padding="normal"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--dash-surface-muted)] border border-[var(--dash-line)]">
                <span className="text-xs font-semibold text-[var(--dash-ink)]">Account status</span>
                <ProtectedStatus label={state.label} tone={state.tone} />
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--dash-surface-muted)] border border-[var(--dash-line)] text-xs text-[var(--dash-ink-secondary)]">
                <strong className="block text-[var(--dash-ink)] mb-0.5">Collection point:</strong>
                {pickupConfigured
                  ? "Saved pickup address is configured for new delivery collections."
                  : "No pickup address saved. Add an address to speed up courier dispatch."}
              </div>
              <DashboardIllustrationAsset role="store" className={styles.illustrationCompact} />
            </div>
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* Row 3: Recent Courier Delivery Requests (12 cols) */}
      <DashboardGrid ariaLabel="Recent courier deliveries">
        <DashboardCol span={12}>
          <DashboardCard
            eyebrow="Merchant courier"
            title="Recent courier delivery requests"
            description="Store-created courier requests remain separate from marketplace fulfilment"
            action={
              recentCourierOrders.length > 0 ? (
                <Link className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} href="/store/orders">
                  View all courier orders
                </Link>
              ) : undefined
            }
            padding="normal"
          >
            <StoreCourierOrderList compact orders={recentCourierOrders} />
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>
    </DashboardCanvas>
  );
}
