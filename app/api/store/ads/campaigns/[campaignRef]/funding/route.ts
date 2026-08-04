import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { AdvertisingFundingService } from "@/lib/advertising/funding.service";
import { campaignFundingInputSchema } from "@/lib/advertising/route-input";

export async function POST(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  const store = await getStoreForUser(session.id);
  if (!store) return forbidden("No store found for this account.");

  try {
    const parsed = campaignFundingInputSchema.safeParse(await request.json());
    if (!parsed.success) return unprocessable("Campaign funding input is invalid.");
    const body = parsed.data;
    const service = new AdvertisingFundingService();
    const result = await service.fundAdvertisingCampaignFromStoreWallet({
      campaignVersionId: body.campaignVersionId,
      storeId: store.id,
      amount: body.amount,
      actorUserId: session.id,
      operationId: body.operationId ?? `OP-FUND-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      requestHash: body.requestHash ?? `HASH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    });
    return ok(result);
  } catch (error: unknown) {
    return unprocessable(error instanceof Error ? error.message : "Could not allocate campaign funds.");
  }
}
