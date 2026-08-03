import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicantProfileService } from "@/lib/recruitment/applicant-profile.service";
import { ApplicationService } from "@/lib/recruitment/application.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const profileService = new ApplicantProfileService(prisma);
    const profile = await profileService.getProfileByUserId(user.id);
    if (!profile) return NextResponse.json({ success: true, data: [] });

    const appService = new ApplicationService(prisma);
    const applications = await appService.listApplications({ applicantProfileId: profile.id });

    // Clean DTO: exclude internal reviewer notes, EE data, check evidence
    const safeApplications = applications.map((app: any) => ({
      reference: app.publicReference,
      openingTitle: app.openingVersion?.publicTitle || "Position",
      status: app.status,
      currentStage: app.currentStage,
      submittedAt: app.submittedAt,
      createdAt: app.createdAt,
    }));

    return NextResponse.json({ success: true, data: safeApplications });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const profileService = new ApplicantProfileService(prisma);
    const profile = await profileService.getProfileByUserId(user.id);

    if (!profile) {
      return NextResponse.json({ success: false, error: "Applicant profile required." }, { status: 400 });
    }

    const appService = new ApplicationService(prisma);
    const application = await appService.createDraftApplication({
      applicantProfileId: profile.id,
      openingId: body.openingId,
      openingVersionId: body.openingVersionId,
      applicationFormVersionId: body.applicationFormVersionId,
      operationId: body.operationId || `APP-OP-${Date.now()}`,
      requestHash: body.requestHash || `HASH-${Date.now()}`,
    });

    return NextResponse.json({ success: true, data: application });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
