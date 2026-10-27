import { DASHBOARD_TIMEZONE } from "./dashboard-period";
import type { DashboardWindow } from "./types";
export type WeekdayCount = Readonly<{ label: string; value: number }>;
export function weekdayCounts(
  dates: readonly Date[],
  window: DashboardWindow,
): readonly WeekdayCount[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = labels.map((label) => ({ label, value: 0 }));
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: DASHBOARD_TIMEZONE,
  });
  for (const date of dates) {
    if (date >= window.start && date < window.end) {
      const index = labels.indexOf(formatter.format(date));
      if (index >= 0) values[index].value++;
    }
  }
  return values;
}
