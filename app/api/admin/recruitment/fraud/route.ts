import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { RecruitmentFraudService } from "@/lib/recruitment/fraud.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_FRAUD_READ });

    const service = new RecruitmentFraudService(prisma);
    const cases = await service.listFraudCases();
    return NextResponse.json({ success: true, data: cases });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
