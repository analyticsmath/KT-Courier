export type DashboardPeriod = "TODAY" | "7_DAYS" | "30_DAYS" | "12_WEEKS";
export type ComparisonValue = Readonly<{
  current: number | string;
  previous: number | string;
  changePercent: number | null;
  direction: "up" | "down" | "flat" | "unavailable";
}>;
export type TimeBucket = Readonly<{ start: string; end: string; label: string; value: number }>;
export type DashboardWindow = Readonly<{
  period: DashboardPeriod; start: Date; end: Date; previousStart: Date; label: string;
}>;
export type CountInsight = Readonly<{
  title: string; definition: string; periodLabel: string;
  comparison: ComparisonValue; buckets: readonly TimeBucket[];
  seriesUnavailable: boolean;
}>;
