import { describe, expect, it, vi } from "vitest";
import { dashboardWindow, parseDashboardPeriod } from "@/lib/dashboard-insights/dashboard-period";
import { bucketSeries, compareCounts } from "@/lib/dashboard-insights/bucket-series";
import { countInsight } from "@/lib/dashboard-insights/count-insight";

describe("dashboard period truth", () => {
  it("uses Johannesburg midnight across UTC date, month and year boundaries", () => {
    const window = dashboardWindow("TODAY", new Date("2026-01-01T00:00:00Z"));
    expect(window.start.toISOString()).toBe("2025-12-31T22:00:00.000Z");
    expect(window.previousStart.toISOString()).toBe("2025-12-31T20:00:00.000Z");
    expect(window.end.getTime() - window.start.getTime()).toBe(window.start.getTime() - window.previousStart.getTime());
  });
  it("rejects unsupported period input and caps bucket count", () => {
    expect(parseDashboardPeriod("ALL_TIME")).toBe("7_DAYS");
    expect(parseDashboardPeriod(["TODAY", "30_DAYS"])).toBe("7_DAYS");
    for (const period of ["TODAY", "7_DAYS", "30_DAYS", "12_WEEKS"] as const) {
      const window = dashboardWindow(period, new Date("2026-09-16T10:00:00Z"));
      expect(bucketSeries([window.start], window).length).toBeLessThanOrEqual(12);
    }
  });
  it("counts each event once with exclusive end boundaries", () => {
    const window = dashboardWindow("7_DAYS", new Date("2026-09-16T10:00:00Z"));
    const buckets = bucketSeries([new Date(window.start.getTime() - 1), window.start, new Date(window.start.getTime() + 86_400_000), window.end], window);
    expect(buckets.map((bucket) => bucket.value)).toEqual([1, 1, 0, 0, 0, 0, 0]);
    expect(bucketSeries([], window)).toEqual([]);
  });
  it("never invents a comparison against zero", () => {
    expect(compareCounts(5, 0)).toMatchObject({ changePercent: null, direction: "unavailable" });
    expect(compareCounts(0, 0)).toMatchObject({ changePercent: null, direction: "unavailable" });
    expect(compareCounts(3, 6)).toMatchObject({ changePercent: -50, direction: "down" });
    expect(() => compareCounts(-1, 2)).toThrow();
  });
  it("withholds truncated series while retaining independently counted totals", async () => {
    const window = dashboardWindow("7_DAYS", new Date("2026-09-16T10:00:00Z"));
    const count = vi.fn().mockResolvedValueOnce(20_000).mockResolvedValueOnce(10_000);
    const insight = await countInsight(window, "Activity", "Recorded events", { count, dates: async () => Array(10_001).fill(window.start) });
    expect(insight.seriesUnavailable).toBe(true);
    expect(insight.buckets).toEqual([]);
    expect(insight.comparison.current).toBe(20_000);
    expect(count).toHaveBeenNthCalledWith(2, window.previousStart, window.start);
  });
});
