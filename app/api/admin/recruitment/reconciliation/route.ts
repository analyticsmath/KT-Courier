import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { RecruitmentReconciliationService } from "@/lib/recruitment/reconciliation.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_RECONCILIATION_READ });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as any;
    const service = new RecruitmentReconciliationService(prisma);
    const cases = await service.listReconciliationCases({ status });

    return NextResponse.json({ success: true, data: cases });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
