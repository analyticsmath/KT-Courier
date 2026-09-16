import type { DashboardPeriod, DashboardWindow } from "./types";

export const DASHBOARD_TIMEZONE = "Africa/Johannesburg";
const DAY = 86_400_000;
const OFFSET = 2 * 3_600_000; // Johannesburg is UTC+02, with no daylight-saving transition.
export function parseDashboardPeriod(value: string | string[] | undefined): DashboardPeriod {
  return value === "TODAY" || value === "30_DAYS" || value === "12_WEEKS" ? value : "7_DAYS";
}
export function dashboardWindow(period: DashboardPeriod, now = new Date()): DashboardWindow {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid dashboard date");
  const midnight = Math.floor((now.getTime() + OFFSET) / DAY) * DAY - OFFSET;
  const days = { TODAY: 1, "7_DAYS": 7, "30_DAYS": 30, "12_WEEKS": 84 }[period];
  const start = new Date(midnight - (days - 1) * DAY);
  const end = new Date(now);
  const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
  const formatter = new Intl.DateTimeFormat("en-ZA", { timeZone: DASHBOARD_TIMEZONE, day: "numeric", month: "short", year: "numeric" });
  return Object.freeze({ period, start, end, previousStart, label: `${formatter.format(start)} – ${formatter.format(end)} · Johannesburg · through ${new Intl.DateTimeFormat("en-ZA", { timeZone: DASHBOARD_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(end)}` });
}
