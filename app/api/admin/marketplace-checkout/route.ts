import { type NextRequest } from "next/server";
import { listMarketplaceCheckoutAdminRecords } from "@/lib/marketplace-checkout/admin-query.service";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { marketplaceJson } from "@/lib/marketplace-checkout/api-policy";
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.MARKETPLACE_CHECKOUT_READ, { request });
  if ("response" in auth) return auth.response;
  return marketplaceJson(await listMarketplaceCheckoutAdminRecords());
}
