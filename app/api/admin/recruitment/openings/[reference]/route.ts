import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { OpeningService } from "@/lib/recruitment/opening.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_OPENINGS_MANAGE });

    const { reference } = await params;
    const service = new OpeningService(prisma);
    const opening = await service.getOpeningByReference(reference);
    if (!opening) return NextResponse.json({ success: false, error: "Opening not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: opening });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_OPENINGS_MANAGE });

    const { reference } = await params;
    const body = await request.json();

    const opening = await prisma.recruitmentOpening.findUnique({
      where: { publicReference: reference },
    });
    if (!opening) return NextResponse.json({ success: false, error: "Opening not found." }, { status: 404 });

    const service = new OpeningService(prisma);
    const version = await service.createOpeningVersion({
      openingId: opening.id,
      versionNumber: body.versionNumber || 1,
      publicTitle: body.publicTitle,
      publicSummary: body.publicSummary,
      responsibilities: body.responsibilities,
      essentialCriteria: body.essentialCriteria,
      desirableCriteria: body.desirableCriteria,
      recruitmentTrack: body.recruitmentTrack,
      relationshipClassification: body.relationshipClassification,
      locationPolicy: body.locationPolicy,
      primaryLocation: body.primaryLocation,
      applicationFormVersionId: body.applicationFormVersionId,
      screeningPolicyVersionId: body.screeningPolicyVersionId,
      evaluationRubricVersionId: body.evaluationRubricVersionId,
      backgroundCheckPolicyVersionId: body.backgroundCheckPolicyVersionId,
      privacyNoticeVersionId: body.privacyNoticeVersionId,
      retentionPolicyVersionId: body.retentionPolicyVersionId,
    });

    return NextResponse.json({ success: true, data: version });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
