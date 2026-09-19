import React from "react";
import Link from "next/link";
import type { DashboardPeriod } from "@/lib/dashboard-insights/types";
import styles from "./charts.module.css";

const PERIODS: readonly [DashboardPeriod, string][] = [
  ["TODAY", "Today"],
  ["7_DAYS", "7 days"],
  ["30_DAYS", "30 days"],
  ["12_WEEKS", "12 weeks"],
];

export function DashboardPeriodControl({
  period,
  href,
  ariaLabel = "Filter activity period",
}: {
  period: DashboardPeriod;
  href: string;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={styles.periods}>
      {PERIODS.map(([value, label]) => {
        const isActive = period === value;
        return (
          <Link
            key={value}
            href={`${href}?period=${value}`}
            className={`${styles.periodLink} ${isActive ? styles.periodActive : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
