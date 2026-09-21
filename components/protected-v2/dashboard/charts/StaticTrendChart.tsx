import React from "react";
import type { TimeBucket } from "@/lib/dashboard-insights/types";
import styles from "./charts.module.css";

export type TrendChartTone = "brand" | "green" | "teal" | "charcoal";

const TONE_CLASSES: Record<TrendChartTone, { line: string; point: string }> = {
  brand: { line: styles.trendLine, point: styles.trendPoint },
  green: { line: `${styles.trendLine} ${styles.trendLineGreen}`, point: `${styles.trendPoint} ${styles.trendPointGreen}` },
  teal: { line: `${styles.trendLine} ${styles.trendLineTeal}`, point: `${styles.trendPoint} ${styles.trendPointTeal}` },
  charcoal: { line: `${styles.trendLine} ${styles.trendLineCharcoal}`, point: `${styles.trendPoint} ${styles.trendPointCharcoal}` },
};

function evenlySpacedIndices(length: number, desiredCount: number): number[] {
  if (length <= desiredCount) return Array.from({ length }, (_, index) => index);
  const indexes = new Set<number>();
  for (let tick = 0; tick < desiredCount; tick += 1) {
    indexes.add(Math.round((tick * (length - 1)) / (desiredCount - 1)));
  }
  return [...indexes];
}

export function StaticTrendChart({
  buckets,
  label,
  tone = "brand",
  heroValue,
  comparisonText,
  scaleLabel,
}: {
  buckets: readonly TimeBucket[];
  label: string;
  tone?: TrendChartTone;
  heroValue?: number | string;
  comparisonText?: string;
  scaleLabel?: string;
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));
  const min = 0;
  const viewWidth = 760;
  const viewHeight = 250;
  const left = 88;
  const right = 16;
  const top = 20;
  const bottom = 40;
  const plotWidth = viewWidth - left - right;
  const plotHeight = viewHeight - top - bottom;
  const xFor = (index: number) =>
    buckets.length <= 1 ? left + plotWidth / 2 : left + (index / (buckets.length - 1)) * plotWidth;
  const yFor = (value: number) => top + ((max - value) / (max - min)) * plotHeight;
  const coordinates = buckets.map((bucket, index) => ({
    bucket,
    x: xFor(index),
    y: yFor(bucket.value),
  }));
  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const desktopTicks = evenlySpacedIndices(buckets.length, 6);
  const mobileTicks = evenlySpacedIndices(buckets.length, 4);
  const toneClasses = TONE_CLASSES[tone];
  const gridFractions = [0, 1 / 3, 2 / 3, 1];
  const formattedHero = typeof heroValue === "number" ? heroValue.toLocaleString("en-ZA") : heroValue;

  return (
    <div className={styles.trendChartContainer}>
      {(heroValue !== undefined || comparisonText || scaleLabel) && (
        <div className={styles.trendChartTop}>
          {heroValue !== undefined ? (
            <div className={styles.barChartSummary}>
              <span className={styles.barChartHeroNum}>{formattedHero}</span>
              {comparisonText && <span className={styles.barChartDelta}>{comparisonText}</span>}
            </div>
          ) : <span />}
          <span className={styles.barChartScale}>{scaleLabel ?? `Scale: 0–${max.toLocaleString("en-ZA")}`}</span>
        </div>
      )}

      <div className={styles.trendPlotArea}>
        <svg
          className={styles.trendPlot}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          role="img"
          aria-label={label}
          preserveAspectRatio="none"
        >
          {gridFractions.map((fraction) => {
            const y = top + fraction * plotHeight;
            return (
              <line className={styles.trendGridLine} key={fraction} x1={left} x2={viewWidth - right} y1={y} y2={y} />
            );
          })}

          {coordinates.length > 1 ? <polyline className={toneClasses.line} points={polyline} /> : null}
          {coordinates.length === 1 ? (
            <circle className={toneClasses.point} cx={coordinates[0].x} cy={coordinates[0].y} r="4" />
          ) : null}
          {coordinates.length <= 14 && coordinates.length > 1
            ? coordinates.map(({ bucket, x, y }) => (
                <circle className={toneClasses.point} key={bucket.start} cx={x} cy={y} r="3.5">
                  <title>{`${bucket.label}: ${bucket.value.toLocaleString("en-ZA")}`}</title>
                </circle>
              ))
            : null}
        </svg>

        <div className={styles.trendAxisLabels} aria-hidden="true">
          {gridFractions.map((fraction) => (
            <span
              className={styles.trendAxisLabel}
              key={fraction}
              style={{ top: `${((top + fraction * plotHeight) / viewHeight) * 100}%` }}
            >
              {Math.round(max * (1 - fraction)).toLocaleString("en-ZA")}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.trendTickRow} aria-hidden="true">
        <div className={styles.trendTickDesktop}>
          {desktopTicks.map((index) => (
            <span
              className={styles.trendTick}
              key={buckets[index].start}
              style={{
                left: `${(xFor(index) / viewWidth) * 100}%`,
                transform: index === 0 ? "none" : index === buckets.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
              title={buckets[index].label}
            >
              {buckets[index].label}
            </span>
          ))}
        </div>
        <div className={styles.trendTickMobile}>
          {mobileTicks.map((index) => (
            <span
              className={styles.trendTick}
              key={buckets[index].start}
              style={{
                left: `${(xFor(index) / viewWidth) * 100}%`,
                transform: index === 0 ? "none" : index === buckets.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
              title={buckets[index].label}
            >
              {buckets[index].label}
            </span>
          ))}
        </div>
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
