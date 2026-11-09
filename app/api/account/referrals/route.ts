import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { badRequest, forbidden, ok, serverError, tooManyRequests, unauthorized } from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  createOrdinaryReferralCode, getOrdinaryReferralCode, OrdinaryReferralError,
  type OrdinaryReferralOwner,
} from "@/lib/rewards/ordinary-referral.service";

const requestSchema = z.object({ storeId: z.string().min(1).max(100).optional() }).strict();

async function owner(request: NextRequest, bodyStoreId?: string): Promise<OrdinaryReferralOwner | null> {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return null;
  if (user.role === "CUSTOMER") return { userId: user.id, ownerType: "CUSTOMER" };
  if (user.role !== "STORE") return null;
  const storeId = bodyStoreId ?? request.nextUrl.searchParams.get("storeId") ?? "";
  if (!storeId) {
    const stores = await prisma.store.findMany({
      where: { ownerUserId: user.id, status: "ACTIVE" }, select: { id: true }, take: 2,
    });
    if (stores.length !== 1) return null;
    return { userId: user.id, ownerType: "STORE", storeId: stores[0].id };
  }
  return { userId: user.id, ownerType: "STORE", storeId };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.status !== "ACTIVE" || !["CUSTOMER", "STORE"].includes(user.role)) return forbidden();
  try {
    const context = await owner(req);
    if (!context) return forbidden("Choose one active owned store.");
    const response = ok({ referral: await getOrdinaryReferralCode(context) });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof OrdinaryReferralError) return forbidden(error.message);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.status !== "ACTIVE" || !["CUSTOMER", "STORE"].includes(user.role)) return forbidden();
  const rate = await checkIpRateLimit(req, "ordinary-referral-issue:" + user.id, RATE_LIMITS.ADDRESS_MUTATION);
  if (!rate.ok) return tooManyRequests(rate.retryAfterSeconds);
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Only an optional store identifier is accepted.");
  try {
    const context = await owner(req, parsed.data.storeId);
    if (!context) return forbidden("Choose one active owned store.");
    const result = await createOrdinaryReferralCode(context);
    const response = ok(result);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof OrdinaryReferralError) return forbidden(error.message);
    return serverError();
  }
}
