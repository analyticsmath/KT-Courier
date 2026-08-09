import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicationService } from "@/lib/recruitment/application.service";
import { InterviewService } from "@/lib/recruitment/interview.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { reference } = await params;
    const appService = new ApplicationService(prisma);
    const app = await appService.getApplicationByReference(reference);

    if (!app || app.applicantProfile?.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Application not found or access denied." }, { status: 404 });
    }

    const interviewService = new InterviewService(prisma);
    const interviews = await interviewService.listInterviewsForApplication(app.id);

    // Filter out internal interviewer notes / scorecards from candidate view
    const safeInterviews = interviews.map((inv: { publicReference: string; interviewType: string; status: string; scheduledAt: Date | null; locationOrUrl: string | null; slot: { publicReference: string; startTime: Date; endTime: Date } | null }) => ({
      reference: inv.publicReference,
      interviewType: inv.interviewType,
      status: inv.status,
      scheduledAt: inv.scheduledAt,
      locationOrUrl: inv.locationOrUrl,
      slot: inv.slot
        ? {
            reference: inv.slot.publicReference,
            startTime: inv.slot.startTime,
            endTime: inv.slot.endTime,
          }
        : null,
    }));

    return NextResponse.json({ success: true, data: safeInterviews });
  } catch (error) {
    return recruitmentRouteError(error, 500);
  }
}
