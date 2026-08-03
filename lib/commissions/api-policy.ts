import { NextResponse, type NextRequest } from "next/server";
import { CommissionError } from "./errors";

export const COMMISSION_API_BODY_LIMIT = 4_096;

export function commissionNoStoreJson<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" } });
}

export function validateCommissionJsonRequest(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const length = Number(request.headers.get("content-length") ?? "0");
  if (contentType !== "application/json") return commissionNoStoreJson({ error: "Content-Type must be application/json." }, 415);
  if (!Number.isFinite(length) || length < 1 || length > COMMISSION_API_BODY_LIMIT) return commissionNoStoreJson({ error: "Request body is too large." }, 413);
  return null;
}

export function commissionApiError(error: unknown): NextResponse {
  if (!(error instanceof CommissionError)) return commissionNoStoreJson({ error: "Commission service is temporarily unavailable." }, 503);
  switch (error.code) {
    case "COMMISSION_PLAN_NOT_FOUND": case "COMMISSION_ACCRUAL_NOT_FOUND": return commissionNoStoreJson({ error: "Commission record was not found." }, 404);
    case "COMMISSION_IDEMPOTENCY_CONFLICT": case "COMMISSION_SETTLEMENT_ALREADY_ACCRUED": case "COMMISSION_POLICY_OVERLAP": return commissionNoStoreJson({ error: "Commission operation conflicts with existing financial evidence." }, 409);
    case "COMMISSION_PRODUCTION_LOCKED": case "COMMISSION_PRODUCTION_VALIDATION_REQUIRED": return commissionNoStoreJson({ error: "Commission operations are inactive pending consolidated validation approval.", blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }, 503);
    case "COMMISSION_MAKER_CHECKER_REQUIRED": return commissionNoStoreJson({ error: "An independent authorized reviewer is required." }, 403);
    case "COMMISSION_INVALID_STATE": case "COMMISSION_REVERSAL_NOT_ALLOWED": case "COMMISSION_DOWNSTREAM_RELEASE_EXISTS": return commissionNoStoreJson({ error: "Commission evidence cannot be changed in its current state." }, 409);
    default: return commissionNoStoreJson({ error: "Commission operation is invalid." }, 422);
  }
}
