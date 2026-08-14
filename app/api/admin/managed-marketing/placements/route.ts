import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isRouteResponse, managedMarketingAdmin, managedMarketingError, managedMarketingService, parseBody, placementCreateSchema } from "@/lib/advertising/managed-marketing-admin-route";

export async function GET(request: NextRequest) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_PLACEMENTS_READ);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ placements: await managedMarketingService.listPlacements(new URL(request.url).searchParams.get("channelReference") ?? undefined) });
}

export async function POST(request: NextRequest) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_PLACEMENTS_MANAGE, true);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, placementCreateSchema); if (isRouteResponse(body)) return body;
  try { return NextResponse.json({ placement: await managedMarketingService.createPlacement({ ...body, actorUserId: auth.user.id, actorRole: auth.user.role }) }, { status: 201 }); }
  catch (error) { return managedMarketingError(error); }
}
