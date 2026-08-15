import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getStorePickupAddress,
  upsertStorePickupAddress,
} from "@/lib/services/store-addresses.service";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  forbidden,
  notFound,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { UserRole } from "@/types/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.STORE) {
    return forbidden("This endpoint is for store accounts.");
  }

  try {
    const state = await getStorePickupAddress(user.id);
    if (!state) return notFound("Store not found.");
    return ok(state);
  } catch {
    return serverError();
  }
}

export async function PATCH(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.STORE) {
    return forbidden("This endpoint is for store accounts.");
  }

  const rl = await checkIpRateLimit(req, `store-pickup-address:${user.id}`, RATE_LIMITS.ADDRESS_MUTATION);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = StorePickupAddressSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const pickupAddress = await upsertStorePickupAddress(user.id, parsed.data);
    if (!pickupAddress) return notFound("Store not found.");
    return ok({ pickupAddress });
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  return PATCH(req);
}
