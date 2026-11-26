import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
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
import { ShipmentDocumentError, type ShipmentDocumentKind } from "@/lib/shipment-documents/contracts";
import { recoverOrIssueShipmentDocument } from "@/lib/shipment-documents/service";
import { UserRole } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RecoverSchema = z
  .object({
    allowSupersede: z.boolean().optional(),
    reason: z.string().trim().min(3).max(300).optional(),
    storeId: z.string().trim().max(80).optional(),
  })
  .strict();

function parseDocumentKind(rawType: string): ShipmentDocumentKind | null {
  const upper = rawType.trim().toUpperCase();
  if (upper === "WAYBILL") return "WAYBILL";
  if (upper === "POD") return "POD";
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id, type: rawType } = await params;
  const docType = parseDocumentKind(rawType);
  if (!docType) return notFound("Unsupported shipment document type.");

  const limit = await checkIpRateLimit(
    request,
    `shipment-doc-recover:${user.id}`,
    RATE_LIMITS.SHIPMENT_DOCUMENT_RECOVER,
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
  const parsed = RecoverSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Invalid shipment document recovery payload.");
  }

  // Only authorized Admin/Super-Admin operators may force-supersede an already-issued
  // immutable document snapshot; customers and stores can only trigger missing issuance.
  const isAdminActor = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (parsed.data.allowSupersede && !isAdminActor) {
    return forbidden("Only authorised operations administrators may supersede an issued document revision.");
  }

  try {
    const { result } = await recoverOrIssueShipmentDocument({
      user,
      orderId: id,
      type: docType,
      allowSupersede: Boolean(isAdminActor && parsed.data.allowSupersede),
      revisionReason: parsed.data.reason ?? null,
      explicitStoreId: parsed.data.storeId ?? null,
    });
    return ok({ document: result });
  } catch (error) {
    if (error instanceof ShipmentDocumentError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.actionHref ? { actionHref: error.actionHref } : {}),
        },
        {
          status: error.statusCode,
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        },
      );
    }
    return serverError();
  }
}
