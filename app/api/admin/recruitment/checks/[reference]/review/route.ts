import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { BackgroundCheckService } from "@/lib/recruitment/background-check.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_CHECKS_REVIEW });

    const { reference } = await params;
    const body = await request.json();
    const service = new BackgroundCheckService(prisma);
    const reviewed = await service.reviewCheckResult(reference, user.id, body.reviewReason || "Human check review completed.");

    return NextResponse.json({ success: true, data: reviewed });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
