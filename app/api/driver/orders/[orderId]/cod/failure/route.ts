import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, serverError, tooManyRequests, unauthorized, unprocessable } from "@/lib/api/response";
import { CashOnDeliveryError, recordCashCollectionFailure } from "@/lib/services/cash-on-delivery.service";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { CodFailureSchema } from "@/lib/validation/cash-on-delivery";
import { formatZodErrors } from "@/lib/validation/auth";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin;
  const user = await getCurrentUser(); if (!user) return unauthorized(); if (user.role !== "DRIVER" || user.status !== "ACTIVE") return forbidden();
  const limit = await checkIpRateLimit(request, `cod-failure:${user.id}`, RATE_LIMITS.COD_COLLECTION); if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  const parsed = CodFailureSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id }, select: { id: true } }); if (!driver) return forbidden();
  try { return ok(await recordCashCollectionFailure({ orderId: (await params).orderId, collectorDriverId: driver.id, actorUserId: user.id, ...parsed.data })); }
  catch (error) { if (error instanceof CashOnDeliveryError) return badRequest(error.code); return serverError(); }
}
