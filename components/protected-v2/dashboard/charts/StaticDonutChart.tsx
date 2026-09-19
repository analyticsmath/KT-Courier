import React from "react";
import styles from "./charts.module.css";

export interface DonutItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface StaticDonutChartProps {
  items: readonly DonutItem[];
  title: string;
  centerValue?: number | string;
  centerLabel?: string;
  layout?: "row" | "column";
}

export function StaticDonutChart({
  items,
  title,
  centerValue,
  centerLabel = "Total",
  layout = "row",
}: StaticDonutChartProps) {
  const total = items.reduce((acc, item) => acc + item.value, 0);
  const displayTotal = centerValue !== undefined ? centerValue : total;

  // SVG dimensions
  const size = 150;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2; // (150 - 18) / 2 = 66
  const circumference = 2 * Math.PI * radius; // ~414.69

  let accumulatedOffset = 0;

  return (
    <div className={`${styles.donutChartWrapper} ${layout === "row" ? styles.donutChartWrapperRow : ""}`}>
      <div className={styles.donutSvgArea} role="img" aria-label={`${title}: total ${displayTotal}`}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className={styles.donutSvg}
          aria-hidden="true"
        >
          {/* Base background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--dash-surface-muted)"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            items.map((item) => {
              if (item.value <= 0) return null;
              const ratio = item.value / total;
              const strokeDasharray = `${ratio * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedOffset;
              accumulatedOffset += ratio * circumference;

              return (
                <circle
                  key={item.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                />
              );
            })}
        </svg>
        <div className={styles.donutCenterLabel}>
          <span className={styles.donutCenterValue}>
            {typeof displayTotal === "number" ? displayTotal.toLocaleString("en-ZA") : displayTotal}
          </span>
          <span className={styles.donutCenterText}>{centerLabel}</span>
        </div>
      </div>

      <div className={styles.donutLegend}>
        {items.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div className={styles.donutLegendItem} key={item.key}>
              <div className={styles.donutLegendLeading}>
                <span className={styles.donutColorDot} style={{ backgroundColor: item.color }} />
                <span className={styles.donutLegendLabel} title={item.label}>
                  {item.label}
                </span>
              </div>
              <div className={styles.donutLegendTrailing}>
                <span className={styles.donutLegendCount}>{item.value.toLocaleString("en-ZA")}</span>
                <span className={styles.donutLegendPercent}>({percent}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
