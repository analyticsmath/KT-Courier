import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isRouteResponse, managedMarketingAdmin, managedMarketingError, managedMarketingService, packageSchema, parseBody } from "@/lib/advertising/managed-marketing-admin-route";

export async function GET(request: NextRequest) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_PACKAGES_READ);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ packages: await managedMarketingService.listPackages(new URL(request.url).searchParams.get("channelReference") ?? undefined) });
}

export async function POST(request: NextRequest) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_PACKAGES_CREATE, true);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, packageSchema); if (isRouteResponse(body)) return body;
  try { return NextResponse.json({ packageVersion: await managedMarketingService.createPackage({ ...body, actorUserId: auth.user.id, actorRole: auth.user.role }) }, { status: 201 }); }
  catch (error) { return managedMarketingError(error); }
}
