import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { managedMarketingAdmin, managedMarketingError, managedMarketingService } from "@/lib/advertising/managed-marketing-admin-route";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_PACKAGES_ACTIVATE, true);
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  try { return NextResponse.json({ packageVersion: await managedMarketingService.activatePackage(reference, { actorUserId: auth.user.id, actorRole: auth.user.role }) }); }
  catch (error) { return managedMarketingError(error); }
}
