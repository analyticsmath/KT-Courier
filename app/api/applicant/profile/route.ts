import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicantProfileService } from "@/lib/recruitment/applicant-profile.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = new ApplicantProfileService(prisma);
    const profile = await service.getProfileByUserId(user.id);

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return recruitmentRouteError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const service = new ApplicantProfileService(prisma);
    const profile = await service.createOrGetApplicantProfile({
      userId: user.id,
      legalName: body.legalName,
      preferredName: body.preferredName,
      primaryEmailReference: user.email,
      primaryPhoneReference: body.phone,
      city: body.city,
      province: body.province,
      workAuthorizationStatus: body.workAuthorizationStatus,
      isAdult: body.isAdult ?? true,
    });

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const service = new ApplicantProfileService(prisma);
    const profile = await service.updateProfile(user.id, {
      preferredName: body.preferredName,
      primaryPhoneReference: body.phone,
      city: body.city,
      province: body.province,
      workAuthorizationStatus: body.workAuthorizationStatus,
    });

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
