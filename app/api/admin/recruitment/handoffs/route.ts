import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { OnboardingHandoffService } from "@/lib/recruitment/onboarding-handoff.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_HANDOFFS_READ });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const service = new OnboardingHandoffService(prisma);
    const handoffs = await service.listHandoffs({ status });

    return NextResponse.json({ success: true, data: handoffs });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
