import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicantProfileService } from "@/lib/recruitment/applicant-profile.service";
import { InterviewService } from "@/lib/recruitment/interview.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { reference } = await params;
    const body = await request.json();

    const profileService = new ApplicantProfileService(prisma);
    const profile = await profileService.getProfileByUserId(user.id);
    if (!profile) return NextResponse.json({ success: false, error: "Applicant profile required." }, { status: 400 });

    const interviewService = new InterviewService(prisma);
    const updated = await interviewService.selectSlot(reference, body.slotReference, profile.id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
