import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { managedMarketingAdmin, managedMarketingError, managedMarketingService, revenueReportQuerySchema } from "@/lib/advertising/managed-marketing-admin-route";

export async function GET(request: NextRequest) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_REPORTS_READ);
  if ("response" in auth) return auth.response;
  const query = revenueReportQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "MANAGED_MARKETING_REPORT_INVALID" }, { status: 422 });
  try { return NextResponse.json({ reports: await managedMarketingService.listRevenueReports({ actorUserId: auth.user.id, actorRole: auth.user.role }, query.data) }); }
  catch (error) { return managedMarketingError(error); }
}
