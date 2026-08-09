import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { ApplicationService } from "@/lib/recruitment/application.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_APPLICATIONS_READ });

    const { searchParams } = new URL(request.url);
    const openingId = searchParams.get("openingId") || undefined;
    const status = searchParams.get("status") || undefined;

    const service = new ApplicationService(prisma);
    const applications = await service.listApplications({ openingId, status });
    return NextResponse.json({ success: true, data: applications });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
