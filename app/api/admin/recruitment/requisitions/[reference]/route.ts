import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { RequisitionService } from "@/lib/recruitment/requisition.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_REQUISITIONS_MANAGE });

    const { reference } = await params;
    const service = new RequisitionService(prisma);
    const req = await service.getRequisition(reference);
    if (!req) return NextResponse.json({ success: false, error: "Requisition not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: req });
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
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_REQUISITIONS_MANAGE });

    const { reference } = await params;
    const body = await request.json();
    const updated = await prisma.recruitmentRequisition.update({
      where: { publicReference: reference },
      data: {
        requestedHeadcount: body.requestedHeadcount,
        businessJustification: body.businessJustification,
        compensationMinimum: body.compensationMinimum,
        compensationMaximum: body.compensationMaximum,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
