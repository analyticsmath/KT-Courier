import React from "react";
import type { TimeBucket } from "@/lib/dashboard-insights/types";
import { StaticBarChart, type BarChartTone } from "./StaticBarChart";
import { StaticTrendChart, type TrendChartTone } from "./StaticTrendChart";

type ActivityTone = BarChartTone & TrendChartTone;

export function StaticActivityChart({
  buckets,
  label,
  tone = "brand",
  heroValue,
  comparisonText,
}: {
  buckets: readonly TimeBucket[];
  label: string;
  tone?: ActivityTone;
  heroValue?: number | string;
  comparisonText?: string;
}) {
  const shared = { buckets, label, tone, heroValue, comparisonText };
  return buckets.length > 7 ? <StaticTrendChart {...shared} /> : <StaticBarChart {...shared} />;
}
