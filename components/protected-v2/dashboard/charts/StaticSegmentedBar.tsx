import React from "react";
import styles from "./charts.module.css";

export interface SegmentItem {
  key: string;
  label: string;
  value: number;
  color: string;
  displayValue?: string;
}

export function StaticSegmentedBar({
  segments,
  label,
  totalLabel,
}: {
  segments: readonly SegmentItem[];
  label: string;
  totalLabel?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={styles.segmentedBarContainer}>
      <div
        className={styles.segmentedTrack}
        role="img"
        aria-label={`${label}: total ${totalLabel ?? total}`}
      >
        {total > 0 ? (
          segments.map((segment) => {
            if (segment.value <= 0) return null;
            const pct = (segment.value / total) * 100;
            return (
              <div
                key={segment.key}
                className={styles.segmentedSlice}
                style={{ width: `${pct}%`, backgroundColor: segment.color }}
                title={`${segment.label}: ${segment.displayValue ?? segment.value} (${Math.round(pct)}%)`}
              />
            );
          })
        ) : (
          <div className={styles.segmentedSlice} style={{ width: "100%", backgroundColor: "var(--dash-line)" }} />
        )}
      </div>

      <div className={styles.donutLegend}>
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div className={styles.donutLegendItem} key={s.key}>
              <div className={styles.donutLegendLeading}>
                <span className={styles.donutColorDot} style={{ backgroundColor: s.color }} />
                <span className={styles.donutLegendLabel}>{s.label}</span>
              </div>
              <div className={styles.donutLegendTrailing}>
                <span className={styles.donutLegendCount}>{s.displayValue ?? s.value.toLocaleString("en-ZA")}</span>
                <span className={styles.donutLegendPercent}>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
