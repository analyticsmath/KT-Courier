import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OpeningService } from "@/lib/recruitment/opening.service";
import { RecruitmentTrack } from "@/types/db";
import { recruitmentRouteError } from "@/lib/recruitment/route-error";

function recruitmentTrackFromQuery(value: string | null): RecruitmentTrack | undefined {
  return Object.values(RecruitmentTrack).find((track) => track === value);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const track = recruitmentTrackFromQuery(searchParams.get("track"));
    const location = searchParams.get("location") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const openingService = new OpeningService(prisma);
    let openings = await openingService.getPublicOpenings({ track, location });

    if (search) {
      const q = search.toLowerCase();
      openings = openings.filter(
        (o: { title: string | null; summary: string | null; essentialCriteria: string | null }) =>
          o.title?.toLowerCase().includes(q) ||
          o.summary?.toLowerCase().includes(q) ||
          o.essentialCriteria?.toLowerCase().includes(q)
      );
    }

    const startIndex = (page - 1) * limit;
    const paginated = openings.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: paginated,
      meta: {
        page,
        limit,
        total: openings.length,
        totalPages: Math.ceil(openings.length / limit) || 1,
        noFeeStatement: "KT Couriers never charges applicants any application, screening, or placement fee.",
        accessibilityStatement: "KT Couriers is committed to providing reasonable accommodations to all applicants.",
      },
    });
  } catch (error) {
    return recruitmentRouteError(error, 500);
  }
}
