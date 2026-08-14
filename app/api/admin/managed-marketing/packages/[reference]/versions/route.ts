import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isRouteResponse, managedMarketingAdmin, managedMarketingError, managedMarketingService, packageSchema, parseBody } from "@/lib/advertising/managed-marketing-admin-route";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_PACKAGES_CREATE, true);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, packageSchema.omit({ code: true })); if (isRouteResponse(body)) return body;
  const { reference } = await context.params;
  try { return NextResponse.json({ packageVersion: await managedMarketingService.createPackageVersion(reference, { ...body, actorUserId: auth.user.id, actorRole: auth.user.role }) }, { status: 201 }); }
  catch (error) { return managedMarketingError(error); }
}
