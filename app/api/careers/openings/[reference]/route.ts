import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OpeningService } from "@/lib/recruitment/opening.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    const openingService = new OpeningService(prisma);
    const opening = await openingService.getOpeningByReference(reference);

    if (!opening || opening.status !== "PUBLISHED") {
      return NextResponse.json({ success: false, error: "Job opening not found or closed." }, { status: 404 });
    }

    const v = opening.currentVersion;
    const safeDto = {
      openingReference: opening.publicReference,
      versionReference: v?.publicReference,
      title: v?.publicTitle,
      summary: v?.publicSummary,
      responsibilities: v?.responsibilities,
      essentialCriteria: v?.essentialCriteria,
      desirableCriteria: v?.desirableCriteria,
      track: v?.recruitmentTrack,
      relationshipClassification: v?.relationshipClassification,
      locationPolicy: v?.locationPolicy,
      primaryLocation: v?.primaryLocation,
      serviceRegions: v?.serviceRegions,
      scheduleDescription: v?.scheduleDescription,
      compensationDisplayPolicy: v?.compensationDisplayPolicy,
      compensationMinimum: v?.compensationDisplayPolicy !== "HIDDEN" ? v?.compensationMinimum : null,
      compensationMaximum: v?.compensationDisplayPolicy !== "HIDDEN" ? v?.compensationMaximum : null,
      currency: v?.currency,
      applicationClosesAt: v?.applicationClosesAt,
      noFeeStatement: "KT Couriers never charges applicants any application, screening, or placement fee.",
      accessibilityStatement: "KT Couriers is committed to providing reasonable accommodations to all applicants.",
    };

    return NextResponse.json({ success: true, data: safeDto });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch job opening details." },
      { status: 500 }
    );
  }
}
