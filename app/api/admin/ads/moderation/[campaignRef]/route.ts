import { apiRouteError } from "@/lib/api/route-error";
import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok } from "@/lib/api/response";
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
  } catch (error) {
    return apiRouteError(error, { fallbackMessage: "Moderation failed.", domainErrorStatus: 422 });
  }
}
