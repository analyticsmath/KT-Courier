import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, unprocessable, serverError } from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ADVERTISING_CAMPAIGNS_REVIEW, { request });
  if (auth.response) return auth.response;

  try {
    const { campaignRef } = await params;
    const body = await request.json();
    const service = new AdvertisingCampaignService();
    const result = await service.moderateCampaign(
      campaignRef,
      body.action, // "APPROVE" | "REJECT"
      auth.user.id,
      body.rejectionReason
    );
    return ok(result);
  } catch (error: any) {
    return unprocessable(error.message || "Moderation failed.");
  }
}
