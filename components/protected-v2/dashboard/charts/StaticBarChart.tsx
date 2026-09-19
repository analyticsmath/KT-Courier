import React from "react";
import type { TimeBucket } from "@/lib/dashboard-insights/types";
import styles from "./charts.module.css";

export type BarChartTone = "brand" | "green" | "teal" | "charcoal";

export interface StaticBarChartProps {
  buckets: readonly TimeBucket[];
  label: string;
  tone?: BarChartTone;
  heroValue?: number | string;
  comparisonText?: string;
  scaleLabel?: string;
}

const TONE_CLASSES: Record<BarChartTone, string> = {
  brand: styles.barFill,
  green: `${styles.barFill} ${styles.barFillGreen}`,
  teal: `${styles.barFill} ${styles.barFillTeal}`,
  charcoal: `${styles.barFill} ${styles.barFillCharcoal}`,
};

export function StaticBarChart({
  buckets,
  label,
  tone = "brand",
  heroValue,
  comparisonText,
  scaleLabel,
}: StaticBarChartProps) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const fillClass = TONE_CLASSES[tone];

  return (
    <div className={styles.barChartContainer}>
      <div className={styles.barChartTop}>
        {heroValue !== undefined ? (
          <div className={styles.barChartSummary}>
            <span className={styles.barChartHeroNum}>
              {typeof heroValue === "number" ? heroValue.toLocaleString("en-ZA") : heroValue}
            </span>
            {comparisonText && <span className={styles.barChartDelta}>{comparisonText}</span>}
          </div>
        ) : (
          <div />
        )}
        <span className={styles.barChartScale}>
          {scaleLabel ?? `Scale: 0–${max.toLocaleString("en-ZA")}`}
        </span>
      </div>

      <div className={styles.barChartColumns} role="img" aria-label={label}>
        {buckets.map((bucket) => {
          const heightPercent = Math.round((bucket.value / max) * 100);
          return (
            <div className={styles.barColumn} key={bucket.start}>
              <span className={styles.barCount}>{bucket.value > 0 ? bucket.value.toLocaleString("en-ZA") : "0"}</span>
              <div className={styles.barTrack}>
                <div
                  className={fillClass}
                  style={{ height: `${Math.max(2, heightPercent)}%` }}
                  title={`${bucket.label}: ${bucket.value}`}
                />
              </div>
              <span className={styles.barLabel} title={bucket.label}>
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>

      <details className={styles.chartAlternative}>
        <summary>View raw data table for {label}</summary>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Time window</th>
              <th scope="col">Start (UTC)</th>
              <th scope="col">End (UTC)</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.start}>
                <th scope="row">{bucket.label}</th>
                <td>{bucket.start}</td>
                <td>{bucket.end}</td>
                <td>{bucket.value.toLocaleString("en-ZA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
