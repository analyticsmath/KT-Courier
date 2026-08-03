import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, unauthorized, unprocessable, tooManyRequests } from "@/lib/api/response";
import { formatZodErrors } from "@/lib/validation/auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { calculateRoute } from "@/lib/maps/routes.service";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const RouteEstimateSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
});

export async function POST(req: NextRequest) {
  // Rate limit — prevent Google Maps cost abuse
  const rl = checkIpRateLimit(req, "route-estimate", RATE_LIMITS.ORDER_ESTIMATE);
  if (!rl.ok) {
    return tooManyRequests(rl.retryAfterSeconds);
  }

  // Origin check — reject cross-site requests
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = RouteEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Invalid coordinates.", formatZodErrors(parsed.error.issues));
  }

  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = parsed.data;

  const result = await calculateRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);

  if (!result.ok) {
    return ok({
      available: false,
      reason: result.error.code,
      message: result.error.message,
    });
  }

  return ok({
    available: true,
    distanceMeters: result.route.distanceMeters,
    durationSeconds: result.route.durationSeconds,
    routeSummary: result.route.routeSummary,
    provider: result.route.provider,
  });
}
