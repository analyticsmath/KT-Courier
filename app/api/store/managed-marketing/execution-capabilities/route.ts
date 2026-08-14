import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { storeMarketingActor, storeMarketingError } from "@/lib/advertising/managed-marketing-store-route";

const service = new ManagedMarketingService();

// Safe Phase C discovery contract: no provider credentials or implementation
// details are exposed, and automated publishing is never implied by a channel.
export async function GET() {
  const auth = await storeMarketingActor(PERMISSIONS.MANAGED_MARKETING_REQUESTS_CREATE_OWN);
  if ("response" in auth) return auth.response;
  try { return NextResponse.json({ channels: await service.listExecutionCapabilities() }); }
  catch (error) { return storeMarketingError(error); }
}
