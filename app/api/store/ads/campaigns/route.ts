import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";

import {
  ok,
  unauthorized,
  forbidden,
  unprocessable,
  serverError,
} from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";
import { campaignCreateInputSchema } from "@/lib/advertising/route-input";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const workspaceDenied = await requireBusinessApi("/api/store/ads/campaigns");
  if (workspaceDenied) return workspaceDenied;
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const store = await getStoreForUser(session.id, undefined, "marketing");
  if (!store) return forbidden("No store found for this account.");

  try {
    const campaigns = await prisma.advertisingCampaign.findMany({
      where: { storeId: store.id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });
    return ok(campaigns);
  } catch {
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/ads/campaigns");
  if (workspaceDenied) return workspaceDenied;
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const store = await getStoreForUser(session.id, undefined, "marketing");
  if (!store) return forbidden("No store found for this account.");

  try {
    const parsed = campaignCreateInputSchema.safeParse(await request.json());
    if (!parsed.success) return unprocessable("Campaign name is required.");
    const service = new AdvertisingCampaignService();
    const campaign = await service.createCampaign(store.id, parsed.data);
    return ok(campaign);
  } catch (error: unknown) {
    return unprocessable(
      error instanceof Error ? error.message : "Could not create campaign.",
    );
  }
}
