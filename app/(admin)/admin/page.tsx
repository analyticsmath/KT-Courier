import { WorkspaceRefresh } from "@/components/protected-v2/studio/WorkspaceRefresh";
import type { Metadata } from "next";
import { AdminCommandCentre } from "@/components/protected-v2/admin/AdminCommandCentre";
import { getAdminDesk } from "@/lib/dashboard-insights/admin-desk";
import { parseDashboardPeriod } from "@/lib/dashboard-insights/dashboard-period";

export const metadata: Metadata = { title: "Operations desk" };
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const period = parseDashboardPeriod(
    (await searchParams).period ?? "12_WEEKS",
  );
  const desk = await getAdminDesk(period);
  return (
    <AdminCommandCentre
      desk={desk}
      period={period}
      refreshControl={<WorkspaceRefresh checkedAt={new Date().toISOString()} />}
    />
  );
}
