import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { BackgroundCheckService } from "@/lib/recruitment/background-check.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_CHECKS_READ });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const service = new BackgroundCheckService(prisma);
    const checks = await service.listCheckCases({ status });
    return NextResponse.json({ success: true, data: checks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_CHECKS_REQUEST });

    const body = await request.json();
    const service = new BackgroundCheckService(prisma);
    const checkCase = await service.initiateCheckCase({
      applicationId: body.applicationId,
      checkType: body.checkType,
      policyVersionId: body.policyVersionId,
      consentRecordId: body.consentRecordId,
      operationId: body.operationId || `CHK-OP-${Date.now()}`,
      requestHash: body.requestHash || `HASH-${Date.now()}`,
    });

    return NextResponse.json({ success: true, data: checkCase });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
