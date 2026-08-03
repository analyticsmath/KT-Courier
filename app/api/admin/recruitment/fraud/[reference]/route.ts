import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { RecruitmentFraudService } from "@/lib/recruitment/fraud.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_FRAUD_READ });

    const { reference } = await params;
    const service = new RecruitmentFraudService(prisma);
    const fraudCase = await service.getFraudCaseByReference(reference);
    if (!fraudCase) return NextResponse.json({ success: false, error: "Fraud case not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: fraudCase });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
