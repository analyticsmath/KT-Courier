import { recruitmentRouteError } from "@/lib/recruitment/route-error";
 
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { OfferService } from "@/lib/recruitment/offer.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { reference } = await params;
    const body = await request.json();
    const offerService = new OfferService(prisma);
    const offer = await offerService.getOfferByReference(reference);

    if (!offer || offer.application?.applicantProfile?.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Offer not found or access denied." }, { status: 404 });
    }

    const accepted = await offerService.acceptOffer(reference, body.offerVersionReference);
    return NextResponse.json({ success: true, data: accepted });
  } catch (error) {
    return recruitmentRouteError(error, 400);
  }
}
