import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  try {
    const { campaignRef } = await params;
    const service = new AdvertisingCampaignService();
    const result = await service.submitCampaignForReview(session.id, campaignRef);
    return ok(result);
  } catch (error: any) {
    return unprocessable(error.message || "Could not submit campaign for review.");
  }
}
