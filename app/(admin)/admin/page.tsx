import type { Metadata } from "next";
import { AdminCommandCentre } from "@/components/protected-v2/admin/AdminCommandCentre";
import { getAdminDesk } from "@/lib/dashboard-insights/admin-desk";
import { parseDashboardPeriod } from "@/lib/dashboard-insights/dashboard-period";

export const metadata: Metadata = { title: "Operations desk" };
export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const period = parseDashboardPeriod((await searchParams).period);
  return <AdminCommandCentre desk={await getAdminDesk(period)} period={period} />;
}
