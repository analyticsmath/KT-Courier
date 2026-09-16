import { DASHBOARD_TIMEZONE } from "./dashboard-period";
import type { ComparisonValue, DashboardWindow, TimeBucket } from "./types";

export const MAX_INSIGHT_ROWS = 10_000;
export function compareCounts(current: number, previous: number): ComparisonValue {
  if (![current, previous].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("Counts must be nonnegative safe integers");
  return Object.freeze({ current, previous, changePercent: previous === 0 ? null : (current - previous) / previous * 100, direction: previous === 0 ? "unavailable" : current === previous ? "flat" : current > previous ? "up" : "down" });
}
/** Half-open UTC intervals; no synthetic points outside the requested window. */
export function bucketSeries(dates: readonly Date[], window: DashboardWindow): readonly TimeBucket[] {
  if (!dates.length) return Object.freeze([]);
  const width = window.period === "TODAY" ? 3_600_000 * 2 : window.period === "12_WEEKS" ? 86_400_000 * 7 : window.period === "30_DAYS" ? 86_400_000 * 5 : 86_400_000;
  const count = Math.min(12, Math.ceil((window.end.getTime() - window.start.getTime()) / width));
  const values = Array.from({ length: count }, () => 0);
  for (const date of dates) {
    if (date >= window.start && date < window.end) values[Math.floor((date.getTime() - window.start.getTime()) / width)]++;
  }
  const formatter = new Intl.DateTimeFormat("en-ZA", { timeZone: DASHBOARD_TIMEZONE, ...(window.period === "TODAY" ? { hour: "2-digit", minute: "2-digit" } as const : { day: "numeric", month: "short" } as const) });
  return Object.freeze(values.map((value, i) => {
    const start = new Date(window.start.getTime() + i * width);
    const end = new Date(Math.min(start.getTime() + width, window.end.getTime()));
    return Object.freeze({ start: start.toISOString(), end: end.toISOString(), label: formatter.format(start), value });
  }));
}
