import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isRouteResponse, managedMarketingAdmin, managedMarketingError, managedMarketingService, parseBody, rejectActionSchema } from "@/lib/advertising/managed-marketing-admin-route";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_REQUESTS_REJECT, true);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, rejectActionSchema); if (isRouteResponse(body)) return body;
  const { reference } = await context.params;
  try { return NextResponse.json({ request: await managedMarketingService.rejectRequest({ actorUserId: auth.user.id, actorRole: auth.user.role }, reference, body.operationId, body.reason) }); }
  catch (error) { return managedMarketingError(error); }
}
