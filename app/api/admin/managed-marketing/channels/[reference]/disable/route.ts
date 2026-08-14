import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { managedMarketingAdmin, managedMarketingError, managedMarketingService } from "@/lib/advertising/managed-marketing-admin-route";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_CHANNELS_MANAGE, true);
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  try { return NextResponse.json({ channel: await managedMarketingService.setChannelActive(reference, false, { actorUserId: auth.user.id, actorRole: auth.user.role }) }); }
  catch (error) { return managedMarketingError(error); }
}
