import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable, serverError } from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  try {
    const campaigns = await prisma.advertisingCampaign.findMany({
      where: { storeId: session.id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" }
        }
      }
    });
    return ok(campaigns);
  } catch {
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  try {
    const body = await request.json();
    if (!body.name) {
      return unprocessable("Campaign name is required.");
    }
    const service = new AdvertisingCampaignService();
    const campaign = await service.createCampaign(session.id, { name: body.name });
    return ok(campaign);
  } catch (error: any) {
    return unprocessable(error.message || "Could not create campaign.");
  }
}
