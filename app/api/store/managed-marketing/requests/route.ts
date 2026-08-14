import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { createDraftSchema, isStoreMarketingResponse, parseStoreMarketingBody, prepareStoreMarketingMutation, storeMarketingActor, storeMarketingError } from "@/lib/advertising/managed-marketing-store-route";

const service = new ManagedMarketingService();

export async function GET() {
  const auth = await storeMarketingActor(PERMISSIONS.MANAGED_MARKETING_REQUESTS_READ_OWN);
  if ("response" in auth) return auth.response;
  try { return NextResponse.json({ requests: await service.listOwnRequests(auth.actor) }); }
  catch (error) { return storeMarketingError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await storeMarketingActor(PERMISSIONS.MANAGED_MARKETING_REQUESTS_CREATE_OWN);
  if ("response" in auth) return auth.response;
  const guard = await prepareStoreMarketingMutation(request, auth.actor, RATE_LIMITS.MANAGED_MARKETING_REQUEST_CREATE);
  if ("response" in guard) return guard.response;
  const body = await parseStoreMarketingBody(request, createDraftSchema); if (isStoreMarketingResponse(body)) return body;
  try { return NextResponse.json({ request: await service.createDraft({ ...body, actor: auth.actor }) }, { status: 201 }); }
  catch (error) { return storeMarketingError(error); }
}
