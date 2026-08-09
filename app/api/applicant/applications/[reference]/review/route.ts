import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicationService } from "@/lib/recruitment/application.service";

export async function POST(
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

    return NextResponse.json({
      success: true,
      data: {
        reference: app.publicReference,
        status: app.status,
        readyForSubmission: true,
        answerCount: app.answers?.length || 0,
        documentCount: app.documents?.length || 0,
      },
    });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
