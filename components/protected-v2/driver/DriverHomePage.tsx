import React from "react";
import Link from "next/link";
import type { DriverAssignmentDto } from "@/lib/dto/assignment.dto";
import type { DriverSelfDto } from "@/lib/dto/driver.dto";
import { getDriverOperationalPresentation } from "@/lib/driver-presentation/driver-state";
import { prioritiseDriverAssignments } from "@/lib/driver-presentation/assignment-priority";
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
import { DriverActiveRun } from "./DriverActiveRun";
import type { CountInsight, DashboardPeriod } from "@/lib/dashboard-insights/types";
import styles from "../dashboard/dashboard.module.css";

export interface DriverHomePageProps {
  driver: DriverSelfDto;
  assignments: readonly DriverAssignmentDto[];
  insight?: CountInsight | null;
  period?: DashboardPeriod;
  activity?: React.ReactNode;
}

export function DriverHomePage({
  driver,
  assignments,
  insight,
  period = "7_DAYS",
  activity,
}: DriverHomePageProps) {
  const ordered = prioritiseDriverAssignments(assignments);
  const state = getDriverOperationalPresentation({
    status: driver.status,
    availability: driver.availability,
    assignments: ordered,
  });

  const active = state.assignmentId ? ordered.find((a) => a.id === state.assignmentId) ?? null : null;
  const pendingOffers = ordered.filter((a) => a.status === "ASSIGNED");
  const currentWork = ordered.filter(
    (a) => a.status === "ACCEPTED" && !["DELIVERED", "COMPLETED", "CANCELLED", "FAILED"].includes(a.orderStatus)
  );
  const nextRecord = ordered.find((a) => a.id !== active?.id && a.status !== "COMPLETED" && a.status !== "CANCELLED") ?? null;

  // Complete assignment distribution
  const completedAssignments = assignments.filter((a) => a.status === "COMPLETED");
  const acceptedAssignments = currentWork;
  const assignedOffers = pendingOffers;
  const otherAssignments = assignments.filter((a) => a.status === "CANCELLED" || a.status === "REJECTED");

  const assignmentMix: DonutItem[] = [
    { key: "completed", label: "Completed runs", value: completedAssignments.length, color: "var(--dash-green)" },
    { key: "accepted", label: "In progress", value: acceptedAssignments.length, color: "var(--dash-teal)" },
    { key: "assigned", label: "Awaiting decision", value: assignedOffers.length, color: "var(--dash-orange)" },
    { key: "other", label: "Closed / cancelled", value: otherAssignments.length, color: "var(--dash-muted)" },
  ];

  const comparison = insight?.comparison;

  return (
    <DashboardCanvas>
      <DashboardHeader
        eyebrow="Driver operations"
        title={driver.displayName ?? "Driver home"}
        description="Active runs, dispatch offers, vehicle profile, and completed assignment history."
        actions={
          <div className="flex items-center gap-2">
            <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/driver/availability">
              Availability: {driver.availability.toLowerCase()}
            </Link>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/driver/assignments">
              All assignments
            </Link>
          </div>
        }
      />

      {/* Row 1: Active Run Console (8 cols) + Driver Profile & Roster (4 cols) */}
      <DashboardGrid ariaLabel="Active run focus">
        <DashboardCol span={8}>
          {active ? (
            <div className="flex flex-col gap-3">
              <DriverActiveRun assignment={active} />
            </div>
          ) : state.state === "ASSIGNMENT_DECISION_REQUIRED" && pendingOffers[0] ? (
            <DashboardCard
              tone="orange"
              eyebrow="Offer awaiting decision"
              title={
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-lg font-bold tracking-tight">{pendingOffers[0].orderNumber}</span>
                  <ProtectedStatus label="Decision required" tone="warning" />
                </div>
              }
              description="Review the pickup and delivery details to accept or decline."
              action={
                <Link
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  href={`/driver/assignments/${pendingOffers[0].id}`}
                >
                  Review assignment
                </Link>
              }
              padding="normal"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--dash-surface)] border border-[var(--dash-line)]">
                <div>
                  <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--dash-muted)]">
                    Pickup origin
                  </span>
                  <span className="text-sm font-semibold text-[var(--dash-ink)] mt-0.5 block">
                    {pendingOffers[0].pickupCity ?? "Pickup location"}
                  </span>
                </div>
                <div>
                  <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--dash-muted)]">
                    Dropoff destination
                  </span>
                  <span className="text-sm font-semibold text-[var(--dash-ink)] mt-0.5 block">
                    {pendingOffers[0].dropoffCity ?? "Dropoff destination"}
                  </span>
                </div>
              </div>
            </DashboardCard>
          ) : (
            <DashboardCard
              tone="surface"
              eyebrow="Driver status"
              title={state.label}
              description={state.description}
              padding="normal"
            >
              <div className="flex flex-col sm:flex-row items-center gap-5 py-2">
                <DashboardIllustrationAsset role="driver" className="sm:max-w-[160px]" />
                <div className="flex flex-col gap-3 text-center sm:text-left">
                  <p className="text-sm text-[var(--dash-ink-secondary)] m-0">{state.description}</p>
                  <div>
                    <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/driver/availability">
                      Manage availability
                    </Link>
                  </div>
                </div>
              </div>
            </DashboardCard>
          )}
        </DashboardCol>

        <DashboardCol span={4}>
          <DashboardCard
            tone="dark"
            eyebrow="Roster details"
            title="Vehicle & account"
            description="Operational configuration"
            padding="normal"
          >
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-[var(--dash-charcoal-line)]">
                <span className="text-[var(--dash-charcoal-muted)]">Vehicle type</span>
                <strong className="text-[var(--dash-charcoal-text)] capitalize">
                  {driver.vehicleType ? driver.vehicleType.toLowerCase() : "Not assigned"}
                </strong>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-[var(--dash-charcoal-line)]">
                <span className="text-[var(--dash-charcoal-muted)]">Service regions</span>
                <strong className="text-[var(--dash-charcoal-text)]">
                  {driver.serviceRegions.length} assigned
                </strong>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-[var(--dash-charcoal-line)]">
                <span className="text-[var(--dash-charcoal-muted)]">Profile status</span>
                <strong className="text-[var(--dash-charcoal-text)] capitalize">
                  {driver.onboardingStatus.replaceAll("_", " ").toLowerCase()}
                </strong>
              </div>
              <div className="flex gap-2 pt-2">
                <Link className={`${styles.btn} ${styles.btnDark} ${styles.btnSm} flex-1`} href="/driver/profile">
                  View profile
                </Link>
                <Link className={`${styles.btn} ${styles.btnDark} ${styles.btnSm} flex-1`} href="/driver/availability">
                  Toggle online
                </Link>
              </div>
            </div>
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* KPI Metric Strip (4-card band, 2-up on mobile) */}
      <DashboardGrid ariaLabel="Driver workload metrics">
        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Current assignments"
            value={currentWork.length}
            description="Accepted, active runs"
            href="/driver/assignments"
            tone="green"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Awaiting decision"
            value={pendingOffers.length}
            description="Dispatched offers to review"
            href="/driver/assignments"
            tone={pendingOffers.length > 0 ? "orange" : "surface"}
            badge={
              pendingOffers.length > 0 ? (
                <span className={`${styles.chip} ${styles.chipWarning}`}>Action required</span>
              ) : undefined
            }
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Completed in period"
            value={comparison ? comparison.current : completedAssignments.length}
            changePercent={comparison ? comparison.changePercent : null}
            direction={comparison ? comparison.direction : "unavailable"}
            previousValue={comparison ? comparison.previous : undefined}
            description={insight ? insight.periodLabel : "Recorded runs"}
            tone="surface"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Total assigned runs"
            value={assignments.length}
            description="Career assignment history"
            href="/driver/assignments"
            tone="surface"
          />
        </DashboardCol>
      </DashboardGrid>

      {/* Row 2: Analytics (7 cols completed chart + 5 cols assignment state mix) */}
      <DashboardGrid ariaLabel="Driver performance analytics">
        <DashboardCol span={7}>
          {insight ? (
            <DashboardCard
              eyebrow="Activity trend"
              title={insight.title}
              description={`${insight.definition} · ${insight.periodLabel}`}
              action={<DashboardPeriodControl period={period} href="/driver" ariaLabel="Filter completed assignments period" />}
              padding="normal"
            >
              {insight.seriesUnavailable ? (
                <p role="status" className={styles.emptyStateDesc}>
                  Total is available. Detail exceeds display limits for this window; choose a shorter period.
                </p>
              ) : insight.buckets.some((b) => b.value > 0) ? (
                <StaticBarChart
                  buckets={insight.buckets}
                  label={`${insight.title} · ${insight.periodLabel}`}
                  tone="teal"
                  heroValue={comparison ? comparison.current : undefined}
                  comparisonText={
                    comparison && comparison.changePercent !== null
                      ? `${comparison.changePercent > 0 ? "+" : ""}${comparison.changePercent.toFixed(1)}% vs prior period`
                      : undefined
                  }
                />
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateTitle}>No completed assignments recorded</p>
                  <p className={styles.emptyStateDesc}>No runs completed in this period window.</p>
                </div>
              )}
            </DashboardCard>
          ) : activity ? (
            <DashboardCard eyebrow="Activity trend" title="Completed work" padding="normal">
              {activity}
            </DashboardCard>
          ) : (
            <DashboardCard eyebrow="Activity trend" title="Completed assignments" padding="normal">
              <p className={styles.emptyStateDesc}>Activity telemetry unavailable.</p>
            </DashboardCard>
          )}
        </DashboardCol>

        <DashboardCol span={5}>
          <DashboardCard
            eyebrow="Workload composition"
            title="Assignment state mix"
            description="Distribution of all assigned runs"
            padding="normal"
          >
            {assignments.length > 0 ? (
              <StaticDonutChart
                items={assignmentMix}
                title="Assignment state mix"
                centerValue={assignments.length}
                centerLabel="Total runs"
                layout="row"
              />
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>No assignments yet</p>
                <p className={styles.emptyStateDesc}>You haven&apos;t been assigned any runs yet. Toggle availability online to receive dispatch offers.</p>
              </div>
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* Row 3: Upcoming Work Queue / Next Record (12 cols) */}
      {nextRecord && (
        <DashboardGrid ariaLabel="Next assignment">
          <DashboardCol span={12}>
            <DashboardCard
              eyebrow="Work queue"
              title="Next scheduled run"
              description="Next assignment in sequence"
              action={
                <Link
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  href={`/driver/assignments/${nextRecord.id}`}
                >
                  View run
                </Link>
              }
              padding="normal"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <strong className="text-base font-bold text-[var(--dash-ink)] block">
                    {nextRecord.orderNumber}
                  </strong>
                  <span className="text-sm text-[var(--dash-muted)] block mt-0.5">
                    {nextRecord.pickupCity ?? "Pickup"} → {nextRecord.dropoffCity ?? "Destination"}
                  </span>
                </div>
                <ProtectedStatus
                  label={nextRecord.statusLabel}
                  tone={nextRecord.status === "ASSIGNED" ? "warning" : "information"}
                />
              </div>
            </DashboardCard>
          </DashboardCol>
        </DashboardGrid>
      )}
    </DashboardCanvas>
  );
}
