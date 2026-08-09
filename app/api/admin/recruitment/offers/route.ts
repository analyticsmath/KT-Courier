import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { OfferService } from "@/lib/recruitment/offer.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_OFFERS_MANAGE });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const service = new OfferService(prisma);
    const offers = await service.listOffers({ status });
    return NextResponse.json({ success: true, data: offers });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await requirePermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RECRUITMENT_OFFERS_MANAGE });

    const body = await request.json();
    const service = new OfferService(prisma);
    const offer = await service.createOffer({ applicationId: body.applicationId });
    const version = await service.createOfferVersion({
      offerId: offer.id,
      versionNumber: 1,
      roleTitle: body.roleTitle,
      recruitmentTrack: body.recruitmentTrack,
      relationshipClassification: body.relationshipClassification,
      departmentCode: body.departmentCode,
      location: body.location,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      compensationCurrency: body.compensationCurrency,
      compensationAmount: body.compensationAmount,
      compensationPeriod: body.compensationPeriod,
      conditions: body.conditions || {},
      expiryAt: body.expiryAt ? new Date(body.expiryAt) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    return NextResponse.json({ success: true, data: { offer, version } });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
