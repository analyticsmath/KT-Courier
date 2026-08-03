import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, unprocessable, serverError } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ADVERTISING_PLACEMENTS_READ, { request });
  if (auth.response) return auth.response;

  try {
    const placements = await prisma.advertisingPlacementDefinition.findMany();
    return ok(placements);
  } catch {
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ADVERTISING_PLACEMENTS_MANAGE, { request });
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const publicReference = `AD-PL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const placement = await prisma.advertisingPlacementDefinition.create({
      data: {
        publicReference,
        code: body.code,
        sponsoredObjectType: body.sponsoredObjectType,
        surface: body.surface,
        status: body.status || "DRAFT",
        maximumSponsoredItems: Number(body.maximumSponsoredItems),
        minimumOrganicGap: Number(body.minimumOrganicGap),
        allowedCardType: body.allowedCardType,
        measurementPolicyVersion: body.measurementPolicyVersion || "1.0",
        selectionPolicyVersion: body.selectionPolicyVersion || "1.0",
        disclosurePolicyVersion: body.disclosurePolicyVersion || "1.0"
      }
    });
    return ok(placement);
  } catch (error: any) {
    return unprocessable(error.message || "Could not create placement definition.");
  }
}
