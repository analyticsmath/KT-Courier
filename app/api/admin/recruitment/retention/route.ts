import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { PrivacyRetentionService } from "@/lib/recruitment/privacy-retention.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_RETENTION_MANAGE });

    const service = new PrivacyRetentionService(prisma);
    const policies = await service.listRetentionPolicies();
    return NextResponse.json({ success: true, data: policies });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_RETENTION_MANAGE });

    const body = await request.json();
    const service = new PrivacyRetentionService(prisma);
    const policy = await service.createRetentionPolicyVersion({
      versionNumber: body.versionNumber || 1,
      draftApplicationRetentionDays: body.draftApplicationRetentionDays,
      unsuccessfulApplicationRetentionDays: body.unsuccessfulApplicationRetentionDays,
      withdrawnApplicationRetentionDays: body.withdrawnApplicationRetentionDays,
      successfulApplicationRecruitmentRetentionDays: body.successfulApplicationRecruitmentRetentionDays,
      talentPoolRetentionDays: body.talentPoolRetentionDays,
      checkEvidenceRetentionDays: body.checkEvidenceRetentionDays,
      auditRetentionDays: body.auditRetentionDays,
    });

    return NextResponse.json({ success: true, data: policy });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
