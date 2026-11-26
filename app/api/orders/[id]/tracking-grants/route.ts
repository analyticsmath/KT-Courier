import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ShipmentDocumentError,
  TRACKING_GRANT_MAX_TTL_DAYS,
} from "@/lib/shipment-documents/contracts";
import {
  issueTrackingShareGrant,
  listTrackingShareGrants,
  revokeTrackingShareGrant,
} from "@/lib/tracking/recipient-access.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IssueGrantSchema = z
  .object({
    ttlDays: z.number().int().min(1).max(TRACKING_GRANT_MAX_TTL_DAYS).optional(),
    storeId: z.string().trim().max(80).optional(),
  })
  .strict();

const RevokeGrantSchema = z
  .object({
    grantId: z.string().trim().min(4).max(80).optional(),
    grantRef: z.string().trim().min(4).max(80).optional(),
    reason: z.string().trim().min(3).max(300).optional(),
    storeId: z.string().trim().max(80).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.grantId || v.grantRef), {
    message: "Specify grantId or grantRef.",
  });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const explicitStoreId = request.nextUrl.searchParams.get("storeId");

  try {
    const { grants } = await listTrackingShareGrants({
      user,
      orderId: id,
      explicitStoreId,
    });
    return NextResponse.json(
      { grants },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error) {
    if (error instanceof ShipmentDocumentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return serverError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const limit = await checkIpRateLimit(
    request,
    `tracking-grant-issue:${user.id}`,
    RATE_LIMITS.TRACKING_GRANT_MUTATION,
  );
  if (!limit.ok) {
    return limit.failClosed
      ? NextResponse.json(limit.errorResponse, { status: 503 })
      : tooManyRequests(limit.retryAfterSeconds);
  }

  let body: unknown = {};
  const rawBody = await request.text();
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return unprocessable("Invalid request payload.");
    }
  }
  const parsed = IssueGrantSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Invalid tracking grant options.");

  const { id } = await params;
  try {
    const issued = await issueTrackingShareGrant({
      user,
      orderId: id,
      ttlDays: parsed.data.ttlDays,
      explicitStoreId: parsed.data.storeId ?? null,
    });
    return NextResponse.json(
      {
        grant: issued.grant,
        shareUrl: issued.shareUrl,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store, no-cache, max-age=0",
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  } catch (error) {
    if (error instanceof ShipmentDocumentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return serverError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const limit = await checkIpRateLimit(
    request,
    `tracking-grant-revoke:${user.id}`,
    RATE_LIMITS.TRACKING_GRANT_MUTATION,
  );
  if (!limit.ok) {
    return limit.failClosed
      ? NextResponse.json(limit.errorResponse, { status: 503 })
      : tooManyRequests(limit.retryAfterSeconds);
  }

  let body: unknown = {};
  const rawBody = await request.text();
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return unprocessable("Invalid revoke payload.");
    }
  } else {
    const grantId = request.nextUrl.searchParams.get("grantId");
    const grantRef = request.nextUrl.searchParams.get("grantRef");
    const storeId = request.nextUrl.searchParams.get("storeId");
    body = {
      ...(grantId ? { grantId } : {}),
      ...(grantRef ? { grantRef } : {}),
      ...(storeId ? { storeId } : {}),
    };
  }

  const parsed = RevokeGrantSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Specify the tracking grant to revoke.");

  const { id } = await params;
  try {
    const result = await revokeTrackingShareGrant({
      user,
      orderId: id,
      grantId: parsed.data.grantId ?? null,
      grantRef: parsed.data.grantRef ?? null,
      reason: parsed.data.reason ?? null,
      explicitStoreId: parsed.data.storeId ?? null,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof ShipmentDocumentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return serverError();
  }
}
