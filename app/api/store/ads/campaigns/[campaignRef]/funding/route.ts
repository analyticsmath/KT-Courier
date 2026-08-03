import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { AdvertisingFundingService } from "@/lib/advertising/funding.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  try {
    const { campaignRef } = await params;
    const body = await request.json();
    const service = new AdvertisingFundingService();
    const result = await service.fundAdvertisingCampaignFromStoreWallet({
      campaignVersionId: body.campaignVersionId,
      storeId: session.id,
      amount: Number(body.amount),
      actorUserId: session.id,
      operationId: body.operationId || `OP-FUND-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      requestHash: body.requestHash || `HASH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    });
    return ok(result);
  } catch (error: any) {
    return unprocessable(error.message || "Could not allocate campaign funds.");
  }
}
