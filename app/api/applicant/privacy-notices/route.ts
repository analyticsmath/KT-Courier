import { recruitmentRouteError } from "@/lib/recruitment/route-error";
 
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { PrivacyRetentionService } from "@/lib/recruitment/privacy-retention.service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const service = new PrivacyRetentionService(prisma);
    const notices = await service.listPrivacyNotices();
    return NextResponse.json({ success: true, data: notices });
  } catch (error) {
    return recruitmentRouteError(error, 500);
  }
}
