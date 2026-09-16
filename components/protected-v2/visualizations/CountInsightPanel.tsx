import Link from "next/link";
import type { CountInsight, DashboardPeriod, TimeBucket } from "@/lib/dashboard-insights/types";
import { OperationalPanel } from "../surfaces/OperationalPanel";
import styles from "./insights.module.css";

export function DashboardPeriodControl({ period, href }: { period: DashboardPeriod; href: string }) {
  return <nav aria-label="Activity period" className={styles.periods}>{([['TODAY', 'Today'], ['7_DAYS', '7 days'], ['30_DAYS', '30 days'], ['12_WEEKS', '12 weeks']] as const).map(([value, label]) => <Link key={value} href={`${href}?period=${value}`} aria-current={period === value ? "page" : undefined}>{label}</Link>)}</nav>;
}

export function MiniBarChart({ buckets, label }: { buckets: readonly TimeBucket[]; label: string }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));
  return <div className={styles.chart}>
    <p className={styles.axis}>Count · scale 0–{max.toLocaleString("en-ZA")}</p>
    <div className={styles.columns} role="img" aria-label={label}>
      {buckets.map((bucket) => <div className={styles.column} key={bucket.start}>
        <span className={styles.count}>{bucket.value}</span>
        <svg aria-hidden="true" viewBox="0 0 32 100" preserveAspectRatio="none"><rect x="2" y={100 - bucket.value / max * 100} width="28" height={bucket.value / max * 100} rx="2" fill="currentColor" /></svg>
        <span className={styles.label}>{bucket.label}</span>
      </div>)}
    </div>
    <details className={styles.alternative}><summary>View activity data</summary><table><caption>{label}</caption><thead><tr><th scope="col">Bucket start (UTC)</th><th scope="col">Bucket end, exclusive (UTC)</th><th scope="col">Count</th></tr></thead><tbody>{buckets.map((bucket) => <tr key={bucket.start}><th scope="row">{bucket.start}</th><td>{bucket.end}</td><td>{bucket.value}</td></tr>)}</tbody></table></details>
  </div>;
}

export function CountInsightPanel({ insight, period, href }: { insight: CountInsight; period: DashboardPeriod; href: string }) {
  const comparison = insight.comparison;
  const delta = comparison.changePercent;
  return <OperationalPanel title={insight.title} description={insight.periodLabel} action={<DashboardPeriodControl period={period} href={href} />}>
    <div className={styles.summary}><strong>{comparison.current.toLocaleString("en-ZA")}</strong><p>{delta === null ? "No prior-period comparison" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% against the preceding equal-length period`}<span>Previous period: {comparison.previous.toLocaleString("en-ZA")}</span></p></div>
    <p className={styles.definition}>{insight.definition}</p>
    {insight.seriesUnavailable ? <p role="status" className={styles.definition}>The total is available. Activity detail exceeds this dashboard’s display limit; choose a shorter period.</p> : insight.buckets.some((bucket) => bucket.value > 0) ? <MiniBarChart buckets={insight.buckets} label={`${insight.title} · ${insight.periodLabel}`} /> : <p className={styles.empty}>No recorded activity in this period. Choose another period to review earlier activity.</p>}
  </OperationalPanel>;
}
