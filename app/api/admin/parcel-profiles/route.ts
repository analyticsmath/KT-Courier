import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { json, failure, mutation } from "@/lib/client-platform/api";
import { listParcelProfileVersions, ParcelProfileSchema, saveParcelProfile } from "@/lib/commercial/parcel-profiles";
export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_READ);
  if (auth.response) return auth.response;
  try { return json(await listParcelProfileVersions()); } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE, { request });
  if (auth.response) return auth.response;
  const body = await mutation(request, `parcel-profiles:${auth.user.id}`);
  if ("response" in body) return body.response;
  const input = ParcelProfileSchema.safeParse(body.body);
  if (!input.success) return json({ error: "Supply positive dimensions, weight, effective dates, current version, and an audit reason." }, 422);
  try { return json(await saveParcelProfile(auth.user.id, input.data), 201); } catch (error) { return failure(error); }
}
