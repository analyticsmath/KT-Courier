import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { channelUpdateSchema, isRouteResponse, managedMarketingAdmin, managedMarketingError, managedMarketingService, parseBody } from "@/lib/advertising/managed-marketing-admin-route";

export async function PATCH(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_CHANNELS_MANAGE, true);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, channelUpdateSchema); if (isRouteResponse(body)) return body;
  const { reference } = await context.params;
  try { return NextResponse.json({ channel: await managedMarketingService.updateChannel(reference, { ...body, actorUserId: auth.user.id, actorRole: auth.user.role }) }); }
  catch (error) { return managedMarketingError(error); }
}
