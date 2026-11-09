import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getStorePickupAddress,
  upsertStorePickupAddress,
} from "@/lib/services/store-addresses.service";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";
import { formatZodErrors } from "@/lib/validation/auth";
import { notFound, ok, serverError, tooManyRequests, unauthorized, unprocessable } from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { getStorePickupOperationalPreflight } from "@/lib/admin/store-pickup-preflight.service";


export async function GET() {
  const workspaceDenied = await requireBusinessApi("/api/store/pickup-address");
  if (workspaceDenied) return workspaceDenied;
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const state = await getStorePickupAddress(user.id);
    if (!state) return notFound("Store not found.");
    // Sellers need the same explicit checkout blockers on first page load,
    // not only after editing a pickup. Read-only provider failures must never
    // be interpreted as approved delivery coverage.
    let readiness = null;
    try {
      readiness = await getStorePickupOperationalPreflight(state.store.id);
    } catch {
      // Unknown preflight must remain unknown, not silently GREEN.
    }
    return ok({ ...state, readiness });
  } catch {
    return serverError();
  }
}

export async function PATCH(req: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/pickup-address");
  if (workspaceDenied) return workspaceDenied;
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const rl = await checkIpRateLimit(
    req,
    `store-pickup-address:${user.id}`,
    RATE_LIMITS.ADDRESS_MUTATION,
  );
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = StorePickupAddressSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable(
      "Validation failed.",
      formatZodErrors(parsed.error.issues),
    );
  }

  try {
    const pickupAddress = await upsertStorePickupAddress(user.id, parsed.data);
    if (!pickupAddress) return notFound("Store not found.");
    // A saved address is not evidence of a usable delivery route. Return
    // immediate, read-only pickup-area diagnostics for the merchant without
    // failing an already committed save if the mapping provider is down.
    let readiness = null;
    try {
      const savedState = await getStorePickupAddress(user.id, "settings");
      if (savedState) readiness = await getStorePickupOperationalPreflight(savedState.store.id);
    } catch {
      // Report unknown readiness instead of claiming the store is Live.
    }
    return ok({ pickupAddress, readiness });
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/pickup-address");
  if (workspaceDenied) return workspaceDenied;
  return PATCH(req);
}
