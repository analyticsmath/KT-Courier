import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { prepareStoreMarketingMutation, storeMarketingActor, storeMarketingError } from "@/lib/advertising/managed-marketing-store-route";

const service = new ManagedMarketingService();

export async function DELETE(request: NextRequest, context: { params: Promise<{ reference: string; creativeReference: string }> }) {
  const auth = await storeMarketingActor(PERMISSIONS.MANAGED_MARKETING_REQUESTS_MANAGE_OWN);
  if ("response" in auth) return auth.response;
  const guard = await prepareStoreMarketingMutation(request, auth.actor, RATE_LIMITS.MANAGED_MARKETING_REQUEST_MUTATION);
  if ("response" in guard) return guard.response;
  const { reference, creativeReference } = await context.params;
  try { return NextResponse.json(await service.removeCreative(auth.actor, reference, creativeReference)); }
  catch (error) { return storeMarketingError(error); }
}
