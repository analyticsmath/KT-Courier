import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { managedMarketingAdmin, managedMarketingError, managedMarketingService } from "@/lib/advertising/managed-marketing-admin-route";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_REQUESTS_REVIEW);
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  try { return NextResponse.json({ request: await managedMarketingService.getRequestForReview({ actorUserId: auth.user.id, actorRole: auth.user.role }, reference) }); }
  catch (error) { return managedMarketingError(error); }
}
