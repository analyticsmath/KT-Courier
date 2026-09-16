import { bucketSeries, compareCounts, MAX_INSIGHT_ROWS } from "./bucket-series";
import type { CountInsight, DashboardWindow } from "./types";

/** Database adapters receive a bounded interval and select only event dates. */
export async function countInsight(window: DashboardWindow, title: string, definition: string, source: {
  count: (start: Date, end: Date) => Promise<number>;
  dates: (start: Date, end: Date, take: number) => Promise<readonly Date[]>;
}): Promise<CountInsight> {
  const [current, previous, dates] = await Promise.all([
    source.count(window.start, window.end), source.count(window.previousStart, window.start),
    source.dates(window.start, window.end, MAX_INSIGHT_ROWS + 1),
  ]);
  const seriesUnavailable = dates.length > MAX_INSIGHT_ROWS;
  return Object.freeze({ title, definition, periodLabel: window.label, comparison: compareCounts(current, previous), buckets: seriesUnavailable ? [] : bucketSeries(dates, window), seriesUnavailable });
}
