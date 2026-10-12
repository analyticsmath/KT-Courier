import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { mutation, json, failure } from "@/lib/client-platform/api";
import { listTrustedPackageVersions, saveTrustedPackageVersion, actOnTrustedPackageVersion, TrustedPackageDraftSchema, TrustedPackageActionSchema } from "@/lib/marketplace-checkout/parcel-configuration.service";

export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_READ);
  if (auth.response) return auth.response;
  try { return json(await listTrustedPackageVersions()); } catch (error) { return failure(error); }
}
async function mutate(request: NextRequest, action: boolean) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE, { request });
  if (auth.response) return auth.response;
  const body = await mutation(request, `trusted-packages:${auth.user.id}`);
  if ("response" in body) return body.response;
  try { return json(action ? await actOnTrustedPackageVersion(auth.user.id, TrustedPackageActionSchema.parse(body.body)) : await saveTrustedPackageVersion(auth.user.id, TrustedPackageDraftSchema.parse(body.body)), action ? 200 : 201); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) { return mutate(request, false); }
export async function PATCH(request: NextRequest) { return mutate(request, true); }
