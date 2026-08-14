import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { isStoreMarketingResponse, parseStoreMarketingBody, prepareStoreMarketingMutation, storeMarketingActor, storeMarketingError, updateDraftSchema } from "@/lib/advertising/managed-marketing-store-route";

const service = new ManagedMarketingService();

export async function GET(_request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await storeMarketingActor(PERMISSIONS.MANAGED_MARKETING_REQUESTS_READ_OWN);
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  try { return NextResponse.json({ request: await service.getOwnRequest(auth.actor, reference) }); }
  catch (error) { return storeMarketingError(error); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await storeMarketingActor(PERMISSIONS.MANAGED_MARKETING_REQUESTS_MANAGE_OWN);
  if ("response" in auth) return auth.response;
  const guard = await prepareStoreMarketingMutation(request, auth.actor, RATE_LIMITS.MANAGED_MARKETING_REQUEST_MUTATION);
  if ("response" in guard) return guard.response;
  const body = await parseStoreMarketingBody(request, updateDraftSchema); if (isStoreMarketingResponse(body)) return body;
  const { reference } = await context.params;
  try { return NextResponse.json({ request: await service.updateDraft(auth.actor, reference, body) }); }
  catch (error) { return storeMarketingError(error); }
}
