import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { mutation, json, failure } from "@/lib/client-platform/api";
import { CATALOG_JSON_BODY_LIMIT } from "@/lib/catalog/catalog-api-policy";
import { listTrustedPackageVersions, saveTrustedPackageVersion, actOnTrustedPackageVersion, TrustedPackageDraftSchema, TrustedPackageActionSchema } from "@/lib/marketplace-checkout/parcel-configuration.service";

export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_READ);
  if (auth.response) return auth.response;
  try { return json(await listTrustedPackageVersions()); } catch (error) { return failure(error); }
}
async function mutate(request: NextRequest, action: boolean) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE, { request });
  if (auth.response) return auth.response;
  // A version can carry 500 measured products or 100 reviewed consignments;
  // 16 KiB is insufficient for legitimate authoring. Keep the catalog's
  // bounded 256 KiB limit without increasing ordinary mutation exposure.
  const body = await mutation(request, `trusted-packages:${auth.user.id}`, action ? 16 * 1024 : CATALOG_JSON_BODY_LIMIT);
  if ("response" in body) return body.response;
  try { return json(action ? await actOnTrustedPackageVersion(auth.user.id, TrustedPackageActionSchema.parse(body.body)) : await saveTrustedPackageVersion(auth.user.id, TrustedPackageDraftSchema.parse(body.body)), action ? 200 : 201); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) { return mutate(request, false); }
export async function PATCH(request: NextRequest) { return mutate(request, true); }
