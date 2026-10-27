import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { weekdayCounts } from "@/lib/dashboard-insights/activity-cadence";
import { dashboardWindow } from "@/lib/dashboard-insights/dashboard-period";
import { ActivityIntelligence } from "@/components/protected-v2/studio/ActivityIntelligence";
import type { CountInsight } from "@/lib/dashboard-insights/types";

describe("Recorded activity detail", () => {
  it("buckets weekday counts in Johannesburg and honors exclusive end boundaries", () => {
    const window = dashboardWindow("7_DAYS", new Date("2026-10-27T12:00:00Z"));
    const rows = weekdayCounts(
      [
        new Date("2026-10-25T22:30:00Z"),
        window.start,
        window.end,
        new Date(window.start.getTime() - 1),
      ],
      window,
    );
    expect(rows.find((row) => row.label === "Mon")?.value).toBe(1);
    expect(rows.reduce((sum, row) => sum + row.value, 0)).toBe(2);
  });
  it("renders genuine zero counts without false bars or percentages", () => {
    const insight: CountInsight = {
      title: "Orders",
      definition: "Recorded orders",
      periodLabel: "Test window",
      comparison: {
        current: 0,
        previous: 0,
        changePercent: null,
        direction: "unavailable",
      },
      buckets: [],
      weekdayCounts: [{ label: "Mon", value: 0 }],
      seriesUnavailable: false,
    };
    const html = renderToStaticMarkup(
      React.createElement(ActivityIntelligence, { insight }),
    );
    expect(html).toContain("No recorded events in this period.");
    expect(html).toContain("height:0%");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
  it("positions cumulative totals at bucket ends and exposes the real series", () => {
    const insight: CountInsight = {
      title: "Orders",
      definition: "Recorded orders",
      periodLabel: "Test",
      comparison: {
        current: 5,
        previous: 10,
        changePercent: -50,
        direction: "down",
      },
      buckets: [
        {
          start: "2026-10-01T22:00:00Z",
          end: "2026-10-02T22:00:00Z",
          label: "2 Oct",
          value: 2,
        },
        {
          start: "2026-10-02T22:00:00Z",
          end: "2026-10-03T22:00:00Z",
          label: "3 Oct",
          value: 3,
        },
      ],
      seriesUnavailable: false,
    };
    const html = renderToStaticMarkup(
      React.createElement(ActivityIntelligence, { insight }),
    );
    expect(html).toContain('points="20,130 190,88 360,25"');
    expect(html).toMatch(/<th scope="row">0?3 Oct<\/th><td>2<\/td>/);
    expect(html).toMatch(/<th scope="row">0?4 Oct<\/th><td>5<\/td>/);
    expect(html).toContain(
      "Previous period: 10 orders. Current period: 5 orders.",
    );
    expect(html).toContain("-50.0%");
  });
  it("withholds charts when the recorded series exceeds display limits", () => {
    const insight: CountInsight = {
      title: "Orders",
      definition: "Recorded orders",
      periodLabel: "Test",
      comparison: {
        current: 15000,
        previous: 10000,
        changePercent: 50,
        direction: "up",
      },
      buckets: [],
      weekdayCounts: null,
      seriesUnavailable: true,
    };
    const html = renderToStaticMarkup(
      React.createElement(ActivityIntelligence, { insight }),
    );
    expect(html).toContain("Choose a shorter period");
    expect(html).toContain("Weekday detail is unavailable");
    expect(html).toContain("15");
    expect(html).not.toContain("<polyline");
  });
});
