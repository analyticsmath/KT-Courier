import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { OfferService } from "@/lib/recruitment/offer.service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_OFFERS_APPROVE });

    const body = await request.json();
    const service = new OfferService(prisma);
    const approved = await service.approveOfferVersion(body.versionReference, user.id);

    return NextResponse.json({ success: true, data: approved });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
