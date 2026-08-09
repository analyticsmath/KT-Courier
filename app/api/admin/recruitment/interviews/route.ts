import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { InterviewService } from "@/lib/recruitment/interview.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_INTERVIEWS_MANAGE });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const service = new InterviewService(prisma);
    const interviews = await service.listInterviews({ status });
    return NextResponse.json({ success: true, data: interviews });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_INTERVIEWS_MANAGE });

    const body = await request.json();
    const service = new InterviewService(prisma);
    const interview = await service.scheduleInterview({
      applicationId: body.applicationId,
      interviewPlanId: body.interviewPlanId,
      slotId: body.slotId,
      interviewType: body.interviewType || "PANEL_INTERVIEW",
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      locationOrUrl: body.locationOrUrl,
      panelUserIds: body.panelUserIds || [],
    });

    return NextResponse.json({ success: true, data: interview });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
