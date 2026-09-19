import React from "react";
import Link from "next/link";
import styles from "./dashboard.module.css";
import { DashboardCard, type DashboardCardTone } from "./DashboardCard";

export interface DashboardMetricCardProps {
  label: string;
  value: number | string;
  description?: string;
  changePercent?: number | null;
  direction?: "up" | "down" | "flat" | "unavailable";
  previousValue?: number | string;
  href?: string;
  tone?: DashboardCardTone;
  badge?: React.ReactNode;
  className?: string;
}

export function DashboardMetricCard({
  label,
  value,
  description,
  changePercent,
  direction,
  previousValue,
  href,
  tone = "surface",
  badge,
  className = "",
}: DashboardMetricCardProps) {
  const formattedValue = typeof value === "number" ? value.toLocaleString("en-ZA") : value;

  const content = (
    <div className={styles.metricCard}>
      <div className={styles.metricTop}>
        <span className={styles.metricLabel}>{label}</span>
        {badge}
      </div>

      <div className={styles.metricValueRow}>
        <span className={styles.metricValue}>{formattedValue}</span>
        {changePercent !== undefined && changePercent !== null && (
          <span
            className={`${styles.metricDelta} ${
              direction === "up" ? styles.deltaUp : direction === "down" ? styles.deltaDown : styles.deltaFlat
            }`}
            aria-label={`${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% vs previous period`}
          >
            {direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}{" "}
            {Math.abs(changePercent).toFixed(1)}%
          </span>
        )}
      </div>

      {(description || previousValue !== undefined) && (
        <div className={styles.metricMeta}>
          {description && <span>{description}</span>}
          {previousValue !== undefined && previousValue !== null && (
            <span> (Prior: {typeof previousValue === "number" ? previousValue.toLocaleString("en-ZA") : previousValue})</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <DashboardCard tone={tone} padding="compact" className={className}>
      {href ? (
        <Link href={href} className={styles.metricLink}>
          {content}
        </Link>
      ) : (
        content
      )}
    </DashboardCard>
  );
}
