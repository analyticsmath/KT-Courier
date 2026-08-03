import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { OpeningService } from "@/lib/recruitment/opening.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const track = searchParams.get("track") as any;
    const location = searchParams.get("location") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const openingService = new OpeningService(prisma);
    let openings = await openingService.getPublicOpenings({ track, location });

    if (search) {
      const q = search.toLowerCase();
      openings = openings.filter(
        (o: any) =>
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch public openings." },
      { status: 500 }
    );
  }
}
