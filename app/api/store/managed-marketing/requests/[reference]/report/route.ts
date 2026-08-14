import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { storeMarketingActor, storeMarketingError } from "@/lib/advertising/managed-marketing-store-route";

const service = new ManagedMarketingService();

export async function GET(_request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await storeMarketingActor(PERMISSIONS.MANAGED_MARKETING_REQUESTS_READ_OWN);
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  try { return NextResponse.json({ report: await service.getOwnReport(auth.actor, reference) }); }
  catch (error) { return storeMarketingError(error); }
}
