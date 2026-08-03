import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicationService } from "@/lib/recruitment/application.service";
import { BackgroundCheckService } from "@/lib/recruitment/background-check.service";

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

    const checkService = new BackgroundCheckService(prisma);
    const checks = await checkService.getCheckCasesForApplication(app.id);

    // Hide restricted check evidence and internal reviewer notes
    const safeChecks = checks.map((c: any) => ({
      reference: c.publicReference,
      checkType: c.checkType,
      status: c.status,
      safeSummary: c.safeSummary,
      requestedAt: c.requestedAt,
    }));

    return NextResponse.json({ success: true, data: safeChecks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
