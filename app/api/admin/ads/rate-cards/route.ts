import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, unprocessable, serverError } from "@/lib/api/response";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ADVERTISING_RATE_CARDS_READ, { request });
  if (auth.response) return auth.response;

  try {
    const rateCards = await prisma.advertisingRateCardVersion.findMany({
      include: {
        placementDefinition: true
      }
    });
    return ok(rateCards);
  } catch {
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ADVERTISING_RATE_CARDS_MANAGE, { request });
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const publicReference = `AD-RC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const rateCard = await prisma.advertisingRateCardVersion.create({
      data: {
        publicReference,
        placementDefinitionId: body.placementDefinitionId,
        versionNumber: Number(body.versionNumber),
        status: body.status || "DRAFT",
        billingModel: body.billingModel || "COST_PER_VALID_CLICK",
        currency: body.currency || "ZAR",
        costPerValidClick: new Prisma.Decimal(body.costPerValidClick),
        minimumCampaignFunding: new Prisma.Decimal(body.minimumCampaignFunding),
        maximumDailyBudget: body.maximumDailyBudget ? new Prisma.Decimal(body.maximumDailyBudget) : null,
        maximumTotalBudget: body.maximumTotalBudget ? new Prisma.Decimal(body.maximumTotalBudget) : null,
        approvedByUserId: auth.user.id,
        approvedAt: new Date()
      }
    });
    return ok(rateCard);
  } catch (error: any) {
    return unprocessable(error.message || "Could not create rate card version.");
  }
}
