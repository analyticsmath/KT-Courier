import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { OnboardingHandoffService } from "@/lib/recruitment/onboarding-handoff.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_HANDOFFS_READ });

    const { reference } = await params;
    const service = new OnboardingHandoffService(prisma);
    const handoff = await service.getHandoffByReference(reference);
    if (!handoff) return NextResponse.json({ success: false, error: "Handoff not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: handoff });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
