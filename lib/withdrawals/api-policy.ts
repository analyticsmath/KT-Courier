import { NextResponse, type NextRequest } from "next/server";
import { WithdrawalError } from "./errors";

export const WITHDRAWAL_API_BODY_LIMIT = 2_048;

export function withdrawalNoStoreJson<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" } });
}

export function validateWithdrawalJsonRequest(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const length = Number(request.headers.get("content-length") ?? "0");
  if (contentType !== "application/json") return withdrawalNoStoreJson({ error: "Content-Type must be application/json." }, 415);
  if (!Number.isFinite(length) || length < 1 || length > WITHDRAWAL_API_BODY_LIMIT) return withdrawalNoStoreJson({ error: "Request body is too large." }, 413);
  return null;
}

export function withdrawalApiError(error: unknown): NextResponse {
  if (!(error instanceof WithdrawalError)) return withdrawalNoStoreJson({ error: "Withdrawal service is temporarily unavailable." }, 503);
  switch (error.code) {
    case "WITHDRAWAL_NOT_FOUND": return withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404);
    case "WITHDRAWAL_FORBIDDEN": return withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404);
    case "WITHDRAWAL_IDEMPOTENCY_CONFLICT":
    case "WITHDRAWAL_PAYOUT_REFERENCE_CONFLICT": return withdrawalNoStoreJson({ error: "Withdrawal request conflicts with its existing operation." }, 409);
    case "WITHDRAWAL_INVALID_STATE":
    case "WITHDRAWAL_RECONCILIATION_REQUIRED": return withdrawalNoStoreJson({ error: "Withdrawal cannot be changed in its current state." }, 409);
    case "WITHDRAWAL_PRODUCTION_LOCKED": return withdrawalNoStoreJson({ error: "Withdrawal operations are inactive pending consolidated validation approval.", blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }, 503);
    case "WITHDRAWAL_CASH_INSUFFICIENT": return withdrawalNoStoreJson({ error: "Payout cannot be completed because cash clearing is insufficient; reconciliation is required." }, 409);
    case "WITHDRAWAL_DUAL_CONTROL_REQUIRED": return withdrawalNoStoreJson({ error: "This payout action requires a separate authorized finance actor." }, 403);
    case "WITHDRAWAL_OWNER_INELIGIBLE":
    case "WITHDRAWAL_DESTINATION_INACTIVE":
    case "WITHDRAWAL_DESTINATION_INVALID":
    case "WITHDRAWAL_POLICY_DISABLED":
    case "WITHDRAWAL_POLICY_LIMIT":
    case "WITHDRAWAL_ACCOUNT_INVALID":
    case "WITHDRAWAL_INSUFFICIENT_BALANCE": return withdrawalNoStoreJson({ error: "Withdrawal is unavailable for the selected amount or destination." }, 422);
    default: return withdrawalNoStoreJson({ error: "Withdrawal request is invalid." }, 422);
  }
}
