import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { managedMarketingAdmin, managedMarketingService } from "@/lib/advertising/managed-marketing-admin-route";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await managedMarketingAdmin(request, PERMISSIONS.MANAGED_MARKETING_PACKAGES_READ);
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  const packageVersion = await managedMarketingService.getPackageVersion(reference);
  return packageVersion ? NextResponse.json({ packageVersion }) : NextResponse.json({ error: "MANAGED_MARKETING_PACKAGE_NOT_FOUND" }, { status: 404 });
}
