import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { RequisitionService } from "@/lib/recruitment/requisition.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_REQUISITIONS_MANAGE });

    const service = new RequisitionService(prisma);
    const requisitions = await service.listRequisitions();
    return NextResponse.json({ success: true, data: requisitions });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_REQUISITIONS_MANAGE });

    const body = await request.json();
    const service = new RequisitionService(prisma);
    const req = await service.createRequisition({
      positionFamilyId: body.positionFamilyId,
      recruitmentTrack: body.recruitmentTrack,
      requestedHeadcount: body.requestedHeadcount || 1,
      departmentCode: body.departmentCode,
      hiringManagerUserId: body.hiringManagerUserId || user.id,
      requestedByUserId: user.id,
      locationPolicy: body.locationPolicy,
      primaryLocation: body.primaryLocation,
      relationshipClassification: body.relationshipClassification,
      compensationCurrency: body.compensationCurrency,
      compensationMinimum: body.compensationMinimum,
      compensationMaximum: body.compensationMaximum,
      businessJustification: body.businessJustification,
      operationId: body.operationId || `REQ-OP-${Date.now()}`,
      requestHash: body.requestHash || "REQ-HASH",
    });

    return NextResponse.json({ success: true, data: req });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
