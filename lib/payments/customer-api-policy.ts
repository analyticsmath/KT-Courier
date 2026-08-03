import { NextResponse, type NextRequest } from "next/server";
import { PaymentError } from "./errors";

export const PAYMENT_API_BODY_LIMIT = 2_048;

export function noStoreJson<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function validatePaymentJsonRequest(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const length = Number(request.headers.get("content-length") ?? "0");
  if (contentType !== "application/json") return noStoreJson({ error: "Content-Type must be application/json." }, 415);
  if (!Number.isFinite(length) || length < 1 || length > PAYMENT_API_BODY_LIMIT) {
    return noStoreJson({ error: "Request body is too large." }, 413);
  }
  return null;
}

export function paymentApiError(error: unknown): NextResponse {
  if (!(error instanceof PaymentError)) return noStoreJson({ error: "Payment service is temporarily unavailable." }, 503);
  console.log("PAYMENT_API_ERROR_CODE:", error.code, error.message);
  switch (error.code) {
    case "PAYMENT_NOT_FOUND":
    case "PAYMENT_ATTEMPT_NOT_FOUND":
    case "PAYMENT_PAYER_NOT_AUTHORIZED":
      return noStoreJson({ error: "Payment not found." }, 404);
    case "PAYMENT_IDEMPOTENCY_CONFLICT":
    case "PAYMENT_ATTEMPT_IDEMPOTENCY_CONFLICT":
    case "PAYMENT_CONCURRENCY_CONFLICT":
    case "PAYMENT_PROVIDER_OUTCOME_UNKNOWN":
      return noStoreJson({ error: "Payment request conflicts with its current state." }, 409);
    case "PAYFAST_PRODUCTION_NOT_READY":
      return noStoreJson({ error: "Payfast production checkout is unavailable until secure confirmation is enabled." }, 503);
    case "PAYFAST_NOT_CONFIGURED":
    case "PAYFAST_CONFIGURATION_INVALID":
    case "PAYFAST_CHECKOUT_NOT_AVAILABLE":
      return noStoreJson({ error: "Payfast checkout is currently unavailable." }, 503);
    case "PAYMENT_ORDER_NOT_FOUND":
    case "PAYMENT_ORDER_NOT_PAYABLE":
    case "PAYMENT_ORDER_ALREADY_PAID":
    case "PAYMENT_STATE_TRANSITION_INVALID":
    case "PAYMENT_ATTEMPT_ALREADY_FINAL":
    case "PAYFAST_ATTEMPT_NOT_ACTIONABLE":
      return noStoreJson({ error: "Payment cannot be started in its current state." }, 409);
    case "PAYFAST_PAYER_EMAIL_REQUIRED":
      return noStoreJson({ error: "A valid account email is required for Payfast checkout." }, 422);
    default:
      return noStoreJson({ error: "Payment request is invalid." }, 422);
  }
}
