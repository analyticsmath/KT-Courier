import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { RecruitmentReconciliationService } from "@/lib/recruitment/reconciliation.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_RECONCILIATION_MANAGE });

    const { reference } = await params;
    const service = new RecruitmentReconciliationService(prisma);
    const result = await service.retryApplicationFreeze(reference);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
