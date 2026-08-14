import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isRouteResponse, managedMarketingAdmin, managedMarketingError, managedMarketingService, parseBody, placementUpdateSchema } from "@/lib/advertising/managed-marketing-admin-route";

export async function PATCH(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_PLACEMENTS_MANAGE, true);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, placementUpdateSchema); if (isRouteResponse(body)) return body;
  const { reference } = await context.params;
  try { return NextResponse.json({ placement: await managedMarketingService.updatePlacement(reference, { ...body, actorUserId: auth.user.id, actorRole: auth.user.role }) }); }
  catch (error) { return managedMarketingError(error); }
}
