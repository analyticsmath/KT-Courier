import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { channelCreateSchema, isRouteResponse, managedMarketingAdmin, managedMarketingError, managedMarketingService, parseBody } from "@/lib/advertising/managed-marketing-admin-route";

export async function GET(request: NextRequest) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_CHANNELS_READ);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ channels: await managedMarketingService.listChannels() });
}

export async function POST(request: NextRequest) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_CHANNELS_MANAGE, true);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, channelCreateSchema); if (isRouteResponse(body)) return body;
  try { return NextResponse.json({ channel: await managedMarketingService.createChannel({ ...body, actorUserId: auth.user.id, actorRole: auth.user.role }) }, { status: 201 }); }
  catch (error) { return managedMarketingError(error); }
}
