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
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_PRIVACY_MANAGE });

    const service = new PrivacyRetentionService(prisma);
    const notices = await service.listPrivacyNotices();
    return NextResponse.json({ success: true, data: notices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_PRIVACY_MANAGE });

    const body = await request.json();
    const service = new PrivacyRetentionService(prisma);
    const version = await service.createPrivacyNoticeVersion({
      versionNumber: body.versionNumber || 1,
      purpose: body.purpose || "Recruitment processing",
      dataCategories: body.dataCategories || ["IDENTITY", "CONTACT"],
      recipientCategories: body.recipientCategories || ["HIRING_TEAM"],
      retentionSummary: body.retentionSummary || "Standard retention policy",
      applicantRights: body.applicantRights || "Access, Correction, Deletion",
      complaintInformation: body.complaintInformation || "Contact privacy office",
    });

    return NextResponse.json({ success: true, data: version });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
