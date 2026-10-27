import React from "react";
import Link from "next/link";
import {
  DashboardCanvas,
  DashboardPeriodControl,
} from "@/components/protected-v2/dashboard";
import { presentOrderStatus } from "@/lib/admin-presentation/operational-status";
import { formatDateTime } from "@/lib/utils/formatters";
import type { AdminDesk } from "@/lib/dashboard-insights/admin-desk";
import type { DashboardPeriod } from "@/lib/dashboard-insights/types";
import {
  ActivityBars,
  DistributionRing,
  StageBars,
} from "../studio/StudioCharts";
import { OperationsWorkbench } from "../studio/OperationsWorkbench";
import { DeliveryHealth } from "../studio/DeliveryHealth";
import s from "../studio/workspaceStudio.module.css";
import table from "../dashboard/dashboard.module.css";

export function AdminCommandCentre({
  desk,
  period,
}: {
  desk: AdminDesk;
  period: DashboardPeriod;
}) {
  const insight = desk.insight;
  const statuses = desk.statusMix ?? [];
  const count = (values: string[]) =>
    statuses
      .filter((x) => values.includes(x.status))
      .reduce((n, x) => n + x._count._all, 0);
  const mix = [
    {
      label: "Delivered",
      value: count(["DELIVERED", "COMPLETED"]),
      color: "#1768ff",
    },
    {
      label: "In progress",
      value: count([
        "CONFIRMED",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "IN_TRANSIT",
        "IN_PROGRESS",
      ]),
      color: "#17181d",
    },
    {
      label: "Needs review",
      value: count(["PENDING", "FAILED", "DELIVERY_ATTEMPTED"]),
      color: "#ff9b88",
    },
    {
      label: "Other / closed",
      value: count(["DRAFT", "CANCELLED"]),
      color: "#fff",
    },
  ];
  const board = desk.dispatch;
  return (
    <DashboardCanvas>
      <header className={s.heading}>
        <div>
          <h1>Operations overview</h1>
          <p>Delivery performance and the next decisions for your team.</p>
        </div>
        <div className={s.actions}>
          {desk.ordersAllowed ? (
            <DashboardPeriodControl
              period={period}
              href="/admin"
              ariaLabel="Filter operations period"
            />
          ) : null}
          {desk.ordersAllowed ? (
            <Link className={s.button} href="/admin/orders">
              All courier orders ↗
            </Link>
          ) : null}
        </div>
      </header>
      <section className={s.analytics} aria-label="Delivery analytics">
        <article className={s.panel}>
          <div className={s.panelTitle}>
            <h2>Courier activity</h2>
            <span className={s.notice}>By creation date</span>
          </div>
          {insight ? (
            <>
              <div className={s.valueRow}>
                <strong>
                  {insight.comparison?.current.toLocaleString("en-ZA") ??
                    "Unavailable"}
                </strong>
                <span>
                  {insight.comparison?.changePercent != null
                    ? `${insight.comparison.changePercent > 0 ? "+" : ""}${insight.comparison.changePercent.toFixed(1)}% vs previous period`
                    : "Courier orders in selected period"}
                </span>
              </div>
              {insight.seriesUnavailable ? (
                <p className={s.notice}>
                  Choose a shorter period to view the activity detail.
                </p>
              ) : (
                <ActivityBars
                  buckets={insight.buckets}
                  label="Courier orders by creation date"
                />
              )}
              {!insight.buckets.some((b) => b.value > 0) ? (
                <p className={s.notice}>No orders recorded in this period.</p>
              ) : null}
              <p className={s.notice}>{insight.periodLabel}</p>
            </>
          ) : (
            <p className={s.notice}>
              Activity data restricted. Unavailable for this account.
            </p>
          )}
        </article>
        <article className={`${s.panel} ${s.bluePanel}`}>
          <div className={s.panelTitle}>
            <h2>Order states</h2>
            <span className={s.notice}>Selected period</span>
          </div>
          {desk.ordersAllowed ? (
            <DistributionRing items={mix} label="Courier order outcomes" />
          ) : (
            <p>Order access restricted.</p>
          )}
        </article>
        <article className={`${s.panel} ${s.yellowPanel}`}>
          <div>
            <h2>Live dispatch board</h2>
            <div className={s.networkArt}>
              <div>
                <strong>
                  {board
                    ? board.counts.assigned + board.counts.unassigned
                    : "Unavailable"}
                </strong>
                <span>orders on the active board</span>
              </div>
              <span aria-hidden="true" style={{ fontSize: "3rem" }}>
                ↗
              </span>
            </div>
          </div>
          <div className={s.metricPair}>
            <div>
              <strong>{board?.counts.assigned ?? "—"}</strong>
              <span>Assigned</span>
            </div>
            <div>
              <strong>{board?.counts.unassigned ?? "—"}</strong>
              <span>Awaiting a driver</span>
            </div>
          </div>
        </article>
      </section>
      <OperationsWorkbench
        title="Attention queue"
        description="Select an order to review its route and open the delivery record."
        emptyTitle={
          desk.attention
            ? "Queue clear. No deliveries require manual review."
            : "Order access restricted."
        }
        rows={(desk.attention ?? []).map((row) => ({
          id: row.id,
          reference: row.orderNumber,
          origin: row.pickupAddress?.city ?? "Pickup not recorded",
          destination: row.dropoffAddress?.city ?? "Destination not recorded",
          status: presentOrderStatus(row.status).label,
          date: formatDateTime(row.createdAt),
          href: `/admin/orders/${row.id}`,
        }))}
      >
        {desk.pendingStores !== null ? (
          <Link className={s.taskCard} href="/admin/stores">
            <h3>Store approvals ↗</h3>
            <strong>{desk.pendingStores}</strong>
            <p>Business accounts awaiting review</p>
          </Link>
        ) : null}
        {board ? (
          <Link className={s.taskCard} href="/admin/dispatch">
            <h3>Driver allocation ↗</h3>
            <strong>{board.counts.unassigned}</strong>
            <p>Open the dispatch board to assign a driver</p>
          </Link>
        ) : (
          <div className={s.taskCard}>
            <h3>Dispatch</h3>
            <p>Unavailable for this account.</p>
          </div>
        )}
      </OperationsWorkbench>
      {desk.ordersAllowed && desk.statusMix ? (
        <DeliveryHealth rows={desk.statusMix} />
      ) : null}
      <section
        className={s.lowerGrid}
        aria-label="Service distribution and coverage"
      >
        <article className={s.panel}>
          <div className={s.panelTitle}>
            <h2>Delivery service mix</h2>
            <span className={s.notice}>Selected period</span>
          </div>
          {desk.ordersAllowed ? (
            <StageBars
              label="Courier service distribution"
              items={(desk.serviceMix ?? []).map((row) => ({
                label: row.deliveryType.replaceAll("_", " ").toLowerCase(),
                value: row._count._all,
                color:
                  (
                    {
                      SAME_DAY: "#1768ff",
                      SCHEDULED: "#191a1e",
                      BUSINESS: "#b6574c",
                      PARCEL_DOCUMENT: "#7084a6",
                    } as Record<string, string>
                  )[row.deliveryType] ?? "#626976",
              }))}
            />
          ) : (
            <p className={s.notice}>Order access restricted.</p>
          )}
          {desk.ordersAllowed && !desk.serviceMix?.length ? (
            <p className={s.notice}>No services requested in this period.</p>
          ) : null}
        </article>
        <article className={s.panel}>
          <div className={s.panelTitle}>
            <h2>Service coverage</h2>
            {desk.regions ? (
              <Link href="/admin/regions">All regions ↗</Link>
            ) : null}
          </div>
          {desk.regions ? (
            <ul className={s.regionList}>
              {desk.regions.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <strong>{r.name}</strong>
                  <span>{r.city}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.notice}>Regional coverage unavailable.</p>
          )}
        </article>
      </section>
      <section className={s.panel} aria-label="Recent exceptions">
        <div className={s.panelTitle}>
          <h2>Recent exceptions</h2>
          <span className={s.notice}>
            {desk.exceptionCount ?? "Unavailable"} recorded
          </span>
        </div>
        {desk.exceptions.length ? (
          <div className={table.queueTableWrap}>
            <table className={table.queueTable}>
              <caption className="sr-only">
                Recent pickup and delivery exceptions
              </caption>
              <thead>
                <tr>
                  <th scope="col">Delivery</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {desk.exceptions.slice(0, 5).map((row) => (
                  <tr key={row.id}>
                    <td>
                      {desk.ordersAllowed ? (
                        <Link
                          className={table.queueReference}
                          href={`/admin/orders/${row.orderId}`}
                        >
                          {row.orderNumber}
                        </Link>
                      ) : (
                        row.orderNumber
                      )}
                    </td>
                    <td>{row.label}</td>
                    <td>{formatDateTime(row.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={s.notice}>
            {desk.exceptionCount === null
              ? "Exception access restricted."
              : "No pickup or delivery exceptions recorded."}
          </p>
        )}
      </section>
    </DashboardCanvas>
  );
}
