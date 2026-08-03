import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicantProfileService } from "@/lib/recruitment/applicant-profile.service";
import { PrivacyRetentionService } from "@/lib/recruitment/privacy-retention.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const profileService = new ApplicantProfileService(prisma);
    const profile = await profileService.getProfileByUserId(user.id);
    if (!profile) return NextResponse.json({ success: true, data: [] });

    const privacyService = new PrivacyRetentionService(prisma);
    const requests = await privacyService.listDataRequests(profile.id);
    return NextResponse.json({ success: true, data: requests });
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
    if (!profile) return NextResponse.json({ success: false, error: "Applicant profile required." }, { status: 400 });

    const privacyService = new PrivacyRetentionService(prisma);
    const req = await privacyService.createDataRequest({
      applicantProfileId: profile.id,
      applicationId: body.applicationId,
      requestType: body.requestType,
      operationId: body.operationId || `SDR-OP-${Date.now()}`,
      requestHash: body.requestHash || `HASH-${Date.now()}`,
    });

    return NextResponse.json({ success: true, data: req });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
