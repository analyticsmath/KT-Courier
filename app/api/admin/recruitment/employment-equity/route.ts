import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { EmploymentEquityService } from "@/lib/recruitment/employment-equity.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_EMPLOYMENT_EQUITY_READ });

    const service = new EmploymentEquityService(prisma);
    const config = await service.getConfiguration();
    const projection = await service.getEquityReportProjection();

    return NextResponse.json({ success: true, data: { config, projection } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_EMPLOYMENT_EQUITY_MANAGE });

    const body = await request.json();
    const service = new EmploymentEquityService(prisma);
    const updated = await service.updateConfiguration(body.publicReference, {
      employerDesignationStatus: body.employerDesignationStatus,
      reportingEnabled: body.reportingEnabled,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
