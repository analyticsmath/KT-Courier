import { NextResponse, type NextRequest } from "next/server";
import { StoreEarningError } from "./errors";

export const STORE_EARNING_API_BODY_LIMIT = 4_096;

export function storeEarningNoStoreJson<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" } });
}

export function validateStoreEarningJsonRequest(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const rawLength = request.headers.get("content-length");
  const length = rawLength && /^\d+$/.test(rawLength) ? parseInt(rawLength, 10) : 0;
  if (contentType !== "application/json") return storeEarningNoStoreJson({ error: "Content-Type must be application/json." }, 415);
  if (length < 1 || length > STORE_EARNING_API_BODY_LIMIT) return storeEarningNoStoreJson({ error: "Request body is missing or too large." }, 413);
  return null;
}

export function storeEarningApiError(error: unknown): NextResponse {
  if (!(error instanceof StoreEarningError)) return storeEarningNoStoreJson({ error: "Store earning service is temporarily unavailable." }, 503);
  switch (error.code) {
    case "STORE_EARNING_NOT_FOUND": return storeEarningNoStoreJson({ error: "Store earning record was not found." }, 404);
    case "STORE_EARNING_FORBIDDEN": return storeEarningNoStoreJson({ error: "Store earning access is not permitted." }, 403);
    case "STORE_EARNING_IDEMPOTENCY_CONFLICT": case "STORE_EARNING_SETTLEMENT_ALREADY_ACCRUED": case "STORE_EARNING_RELEASE_NOT_ELIGIBLE": case "STORE_EARNING_REVERSAL_NOT_ALLOWED": case "STORE_EARNING_REFUND_AFTER_RELEASE": case "STORE_EARNING_RECONCILIATION_REQUIRED": return storeEarningNoStoreJson({ error: "Store earning operation conflicts with immutable financial evidence." }, 409);
    case "STORE_EARNING_PRODUCTION_LOCKED": return storeEarningNoStoreJson({ error: "Store earning operations are inactive pending consolidated validation approval.", blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }, 503);
    default: return storeEarningNoStoreJson({ error: "Store earning operation is invalid." }, 422);
  }
}
