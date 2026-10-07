import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { mutation, json, failure } from "@/lib/client-platform/api";
import { listDeliveryMatrices, saveDeliveryMatrix, actOnDeliveryMatrix, DeliveryMatrixDraftSchema, DeliveryMatrixActionSchema } from "@/lib/marketplace-checkout/delivery-policy-configuration";
export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_READ);
  if (auth.response) return auth.response;
  try { return json(await listDeliveryMatrices()); } catch (error) { return failure(error); }
}
async function mutate(request: NextRequest, action: boolean) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE, { request });
  if (auth.response) return auth.response;
  const body = await mutation(request, `marketplace-matrix:${auth.user.id}`);
  if ("response" in body) return body.response;
  try {
    return json(action ? await actOnDeliveryMatrix(auth.user.id, DeliveryMatrixActionSchema.parse(body.body)) : await saveDeliveryMatrix(auth.user.id, DeliveryMatrixDraftSchema.parse(body.body)), action ? 200 : 201);
  } catch (error) { return failure(error); }
}
export const POST = (request: NextRequest) => mutate(request, false);
export const PATCH = (request: NextRequest) => mutate(request, true);
