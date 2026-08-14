import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { managedMarketingAdmin, managedMarketingError, managedMarketingService, reviewListSchema } from "@/lib/advertising/managed-marketing-admin-route";

export async function GET(request: NextRequest) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_REQUESTS_REVIEW);
  if ("response" in auth) return auth.response;
  const parsed = reviewListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "MANAGED_MARKETING_REQUEST_INVALID" }, { status: 422 });
  try { return NextResponse.json({ requests: await managedMarketingService.listRequestsForReview({ actorUserId: auth.user.id, actorRole: auth.user.role }, parsed.data) }); }
  catch (error) { return managedMarketingError(error); }
}
