import { recruitmentRouteError } from "@/lib/recruitment/route-error";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ApplicationService } from "@/lib/recruitment/application.service";
import { OfferService } from "@/lib/recruitment/offer.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { reference } = await params;
    const appService = new ApplicationService(prisma);
    const app = await appService.getApplicationByReference(reference);

    if (!app || app.applicantProfile?.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Application not found or access denied." }, { status: 404 });
    }

    const offerService = new OfferService(prisma);
    const offer = await offerService.getOfferForApplication(app.id);

    if (!offer) {
      return NextResponse.json({ success: false, error: "No offer issued yet." }, { status: 404 });
    }

    const v = offer.currentVersion;
    const safeOffer = {
      reference: offer.publicReference,
      status: offer.status,
      roleTitle: v?.roleTitle,
      startDate: v?.startDate,
      compensationAmount: v?.compensationAmount,
      compensationCurrency: v?.compensationCurrency,
      compensationPeriod: v?.compensationPeriod,
      expiryAt: v?.expiryAt,
      conditions: v?.conditions,
    };

    return NextResponse.json({ success: true, data: safeOffer });
  } catch (error) {
    return recruitmentRouteError(error, 500);
  }
}
