import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicationService } from "@/lib/recruitment/application.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { reference } = await params;
    const appService = new ApplicationService(prisma);
    const application = await appService.getApplicationByReference(reference);

    if (!application) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (application.applicantProfile?.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    const safeDto = {
      reference: application.publicReference,
      status: application.status,
      currentStage: application.currentStage,
      submittedAt: application.submittedAt,
      openingTitle: application.openingVersion?.publicTitle,
      answers: application.answers?.map((a: any) => ({
        questionKey: a.questionKey,
        answerValue: a.answerValue,
      })),
      documents: application.documents?.map((d: any) => ({
        category: d.documentCategory,
        fileName: d.originalFileName,
        validationStatus: d.validationStatus,
      })),
    };

    return NextResponse.json({ success: true, data: safeDto });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { reference } = await params;
    const appService = new ApplicationService(prisma);
    const application = await appService.getApplicationByReference(reference);

    if (!application || application.applicantProfile?.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Application not found or access denied." }, { status: 404 });
    }

    const body = await request.json();
    if (body.answers && Array.isArray(body.answers)) {
      await appService.saveSubmittedAnswers(application.id, body.answers);
    }

    return NextResponse.json({ success: true, data: { reference, status: "UPDATED" } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
