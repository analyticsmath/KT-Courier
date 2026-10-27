import React from "react";
import Link from "next/link";
import type { DriverAssignmentDto } from "@/lib/dto/assignment.dto";
import type { DriverSelfDto } from "@/lib/dto/driver.dto";
import { getDriverOperationalPresentation } from "@/lib/driver-presentation/driver-state";
import { prioritiseDriverAssignments } from "@/lib/driver-presentation/assignment-priority";
import { summariseDriverAssignments } from "@/lib/dashboard-insights/workflow-summary";
import {
  DashboardCanvas,
  DashboardPeriodControl,
} from "@/components/protected-v2/dashboard";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { DriverActiveRun } from "./DriverActiveRun";
import type {
  CountInsight,
  DashboardPeriod,
} from "@/lib/dashboard-insights/types";
import type { DriverReadinessEvaluation } from "@/lib/services/driver-readiness.service";
import { ActivityBars, DistributionRing } from "../studio/StudioCharts";
import s from "../studio/workspaceStudio.module.css";
import driverStyles from "./driver-pages.module.css";

export interface DriverHomePageProps {
  driver: DriverSelfDto;
  assignments: readonly DriverAssignmentDto[];
  readiness?: DriverReadinessEvaluation | null;
  insight?: CountInsight | null;
  period?: DashboardPeriod;
  activity?: React.ReactNode;
}
export function DriverHomePage({
  driver,
  assignments,
  readiness,
  insight,
  period = "7_DAYS",
  activity,
}: DriverHomePageProps) {
  const ordered = prioritiseDriverAssignments(assignments);
  const state = getDriverOperationalPresentation({
    status: driver.status,
    availability: driver.availability,
    assignments: ordered,
    complianceEligible: readiness?.canBeAvailable,
    complianceSummary: readiness?.blockers[0]?.message,
  });
  const current = state.assignmentId
    ? ordered.find((row) => row.id === state.assignmentId)
    : null;
  const mix = summariseDriverAssignments(assignments);
  const stages = [
    { label: "Completed", value: mix.completed, color: "#1768ff" },
    { label: "In progress", value: mix.active, color: "#191a1e" },
    { label: "Offers", value: mix.offers, color: "#eaff87" },
    { label: "Other / closed", value: mix.other, color: "#efab9f" },
  ];
  return (
    <DashboardCanvas>
      <header className={`${s.heading} ${s.driverHeading}`}>
        <div>
          <h1>{driver.displayName ?? "Driver overview"}</h1>
          <p>Current work, dispatch readiness and your completed deliveries.</p>
        </div>
        <div className={s.actions}>
          <DashboardPeriodControl
            period={period}
            href="/driver"
            ariaLabel="Filter completed assignments period"
          />
          <Link className={s.quietButton} href="/driver/availability">
            Availability: {driver.availability.toLowerCase()}
          </Link>
        </div>
      </header>
      <section
        className={`${s.analytics} ${s.driverAnalytics}`}
        aria-label="Driver activity analytics"
      >
        <article className={s.panel}>
          <div className={s.panelTitle}>
            <h2>Completed runs</h2>
            <Link href="/driver/assignments?filter=history">History ↗</Link>
          </div>
          {insight ? (
            <>
              <div className={s.valueRow}>
                <strong>
                  {insight.comparison.current.toLocaleString("en-ZA")}
                </strong>
                <span>
                  {insight.comparison.changePercent === null
                    ? "Completed in the selected period"
                    : `${insight.comparison.changePercent > 0 ? "+" : ""}${insight.comparison.changePercent.toFixed(1)}% vs previous period`}
                </span>
              </div>
              {insight.seriesUnavailable ? (
                <p className={s.notice}>
                  Choose a shorter period to view the activity detail.
                </p>
              ) : (
                <ActivityBars
                  buckets={insight.buckets}
                  label="Completed assignments by completion date"
                />
              )}
              <p className={s.notice}>{insight.periodLabel}</p>
            </>
          ) : (
            (activity ?? (
              <p className={s.notice}>Completion activity unavailable.</p>
            ))
          )}
        </article>
        <article className={`${s.panel} ${s.bluePanel}`}>
          <div className={s.panelTitle}>
            <h2>Assignment history</h2>
            <span className={s.notice}>All recorded runs</span>
          </div>
          <DistributionRing
            items={stages}
            label="Driver assignment states"
            unit="records"
          />
        </article>
        <article className={`${s.panel} ${s.yellowPanel}`}>
          <div>
            <h2>Work to review</h2>
            <p className={s.balance}>{mix.offers}</p>
            <p className={s.notice}>Dispatch offers awaiting a decision</p>
          </div>
          <div className={s.metricPair}>
            <div>
              <strong>{mix.active}</strong>
              <span>Accepted active runs</span>
            </div>
            <div>
              <strong>{mix.total}</strong>
              <span>Recorded assignments</span>
            </div>
          </div>
          <Link
            className={s.quietButton}
            style={{ marginTop: 18 }}
            href="/driver/assignments"
          >
            Open assignments ↗
          </Link>
        </article>
      </section>
      <section
        className={s.driverWorkGrid}
        aria-label="Current work and readiness"
      >
        <div className={`${s.driverFocus} ${driverStyles.scope}`}>
          {current && current.status === "ACCEPTED" ? (
            <DriverActiveRun assignment={current} />
          ) : current && current.status === "ASSIGNED" ? (
            <article className={`${s.panel} ${s.bluePanel}`}>
              <div className={s.panelTitle}>
                <h2>Offer awaiting your decision</h2>
                <span className={s.notice}>{current.statusLabel}</span>
              </div>
              <h3 className={s.runReference}>{current.orderNumber}</h3>
              <div className={s.routeDetail}>
                <div>
                  <span>Collection</span>
                  <strong>{current.pickupCity ?? "See pickup address"}</strong>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <span>Destination</span>
                  <strong>
                    {current.dropoffCity ?? "See delivery address"}
                  </strong>
                </div>
              </div>
              <p className={s.notice}>
                Review the route and offer details before accepting or
                declining.
              </p>
              <Link
                className={s.button}
                href={`/driver/assignments/${current.id}`}
              >
                Review assignment ↗
              </Link>
            </article>
          ) : (
            <article className={s.panel}>
              <div className={s.panelTitle}>
                <h2>{state.label}</h2>
                <span className={s.stateMark} aria-hidden="true">
                  ↗
                </span>
              </div>
              <p className={s.notice}>{state.description}</p>
              <Link className={s.button} href="/driver/availability">
                Manage availability ↗
              </Link>
            </article>
          )}
        </div>
        <aside className={`${s.panel} ${s.darkPanel}`}>
          <div className={s.panelTitle}>
            <h2>Dispatch readiness</h2>
            <Link href="/driver/profile">Profile ↗</Link>
          </div>
          {readiness ? (
            <>
              <div className={s.readinessCount}>
                <strong>
                  {
                    readiness.checklist.filter(
                      (item) => item.status === "COMPLETED",
                    ).length
                  }
                  <span> / {readiness.checklist.length}</span>
                </strong>
                <span>Requirements satisfied</span>
              </div>
              {readiness.blockers.length ? (
                <ul className={s.readinessList}>
                  {readiness.blockers.map((item) => (
                    <li key={item.key}>
                      <span>{item.message}</span>
                      <Link href={item.actionHref}>{item.actionLabel} ↗</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.darkNotice}>
                  {readiness.isDispatchReady
                    ? "Ready to receive dispatch assignments."
                    : "Requirements are complete. Check your availability to receive assignments."}
                </p>
              )}
            </>
          ) : (
            <p className={s.darkNotice}>
              Readiness information is unavailable. Review your profile before
              changing availability.
            </p>
          )}
          <div className={s.driverFacts}>
            <div>
              <span>Vehicle</span>
              <strong>
                {driver.vehicleType?.replaceAll("_", " ").toLowerCase() ??
                  "Not assigned"}
              </strong>
            </div>
            <div>
              <span>Service regions</span>
              <strong>{driver.serviceRegions.length}</strong>
            </div>
          </div>
        </aside>
      </section>
      <section className={`${s.panel} ${s.driverQueue}`}>
        <div className={s.panelTitle}>
          <h2>Assignment queue</h2>
          <Link href="/driver/assignments">All assignments ↗</Link>
        </div>
        <EditorialTable
          caption="Six assignments from your prioritized queue"
          mobileMode="stack"
          rows={ordered.slice(0, 6)}
          emptyState={
            <p className={s.notice}>
              No assignments yet. Dispatch offers will appear here when assigned
              to you.
            </p>
          }
          columns={[
            {
              id: "reference",
              header: "Assignment",
              priority: "primary",
              cell: (row) => (
                <Link
                  className="eo-table-link"
                  href={`/driver/assignments/${row.id}`}
                >
                  {row.orderNumber}
                </Link>
              ),
            },
            {
              id: "route",
              header: "Route",
              priority: "secondary",
              cell: (row) =>
                `${row.pickupCity ?? "Pickup"} → ${row.dropoffCity ?? "Destination"}`,
            },
            {
              id: "state",
              header: "Assignment state",
              priority: "primary",
              cell: (row) => row.statusLabel,
            },
            {
              id: "delivery",
              header: "Delivery stage",
              priority: "secondary",
              cell: (row) => row.orderStatus.replaceAll("_", " ").toLowerCase(),
            },
          ]}
        />
      </section>
    </DashboardCanvas>
  );
}
