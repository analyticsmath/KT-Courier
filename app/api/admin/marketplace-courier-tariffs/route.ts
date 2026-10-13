import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { failure, json, mutation } from "@/lib/client-platform/api";
import { CourierTariffConfigurationSchema, marketplaceCourierTariffConfiguration, saveMarketplaceCourierTariffConfiguration } from "@/lib/marketplace-checkout/courier-tariff-policy";

export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_READ);
  if (auth.response) return auth.response;
  try { return json(await marketplaceCourierTariffConfiguration()); } catch (error) { return failure(error); }
}
export async function PUT(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE, { request });
  if (auth.response) return auth.response;
  const body = await mutation(request, `marketplace-courier-tariffs:${auth.user.id}`);
  if ("response" in body) return body.response;
  try { return json(await saveMarketplaceCourierTariffConfiguration(auth.user.id, CourierTariffConfigurationSchema.parse(body.body))); } catch (error) { return failure(error); }
}
