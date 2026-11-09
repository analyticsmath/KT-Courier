import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notFound, ok, serverError, tooManyRequests, unprocessable } from "@/lib/api/response";
import { getStorePickupOperationalPreflight } from "@/lib/admin/store-pickup-preflight.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getStorePickupAddressForStore, upsertStorePickupAddressForStore } from "@/lib/services/store-addresses.service";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";
import { formatZodErrors } from "@/lib/validation/auth";

type Context = { params: Promise<{ id: string }> };

async function safeReadiness(id: string) {
  try { return await getStorePickupOperationalPreflight(id); }
  catch { return null; }
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_UPDATE, { request });
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const state = await getStorePickupAddressForStore(id);
    if (!state) return notFound("Store not found.");
    return ok({ ...state, readiness: await safeReadiness(id) });
  } catch { return serverError(); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_UPDATE, { request });
  if (auth.response) return auth.response;
  const { id } = await params;
  const limit = await checkIpRateLimit(request, `admin-store-pickup:${auth.user.id}`, RATE_LIMITS.ADDRESS_MUTATION);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  let body: unknown;
  try { body = await request.json(); } catch { return unprocessable("Invalid request body."); }
  const parsed = StorePickupAddressSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  try {
    if (!await getStorePickupAddressForStore(id)) return notFound("Store not found.");
    const pickupAddress = await upsertStorePickupAddressForStore(id, auth.user.id, parsed.data);
    return ok({ pickupAddress, readiness: await safeReadiness(id) });
  } catch { return serverError(); }
}
