import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { serverError, tooManyRequests } from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { TRACKING_SHARE_COOKIE_NAME } from "@/lib/shipment-documents/contracts";
import {
  GENERIC_TRACKING_LINK_ERROR,
  trackingShareCookieOptions,
  verifyAndResolveTrackingToken,
} from "@/lib/tracking/recipient-access.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExchangeSchema = z
  .object({
    token: z.string().trim().min(16).max(200),
  })
  .strict();

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const limit = await checkIpRateLimit(
    request,
    "tracking-share-exchange",
    RATE_LIMITS.TRACKING_SHARE_EXCHANGE,
  );
  if (!limit.ok) {
    return limit.failClosed
      ? NextResponse.json(limit.errorResponse, { status: 503 })
      : tooManyRequests(limit.retryAfterSeconds);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: GENERIC_TRACKING_LINK_ERROR, code: "TRACKING_LINK_UNAVAILABLE" },
      { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const parsed = ExchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: GENERIC_TRACKING_LINK_ERROR, code: "TRACKING_LINK_UNAVAILABLE" },
      { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  try {
    const resolved = await verifyAndResolveTrackingToken(parsed.data.token);
    if (!resolved) {
      return NextResponse.json(
        { error: GENERIC_TRACKING_LINK_ERROR, code: "TRACKING_LINK_UNAVAILABLE" },
        {
          status: 404,
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
            "Referrer-Policy": "no-referrer",
            "X-Robots-Tag": "noindex, nofollow",
          },
        },
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        redirectPath: `/track/share?g=${encodeURIComponent(resolved.grantRef)}`,
        tracking: resolved.projection,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
    response.cookies.set(
      TRACKING_SHARE_COOKIE_NAME,
      parsed.data.token.trim(),
      trackingShareCookieOptions(resolved.expiresAt),
    );
    return response;
  } catch {
    return serverError();
  }
}

export async function DELETE(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const response = NextResponse.json(
    { cleared: true },
    { status: 200, headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
  response.cookies.delete(TRACKING_SHARE_COOKIE_NAME);
  return response;
}
