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

/** Read payment operations by their actual byte count, not Content-Length.
 * HTTP/2 and edge proxies may omit that header on legitimate JSON POSTs.
 * This streaming cap must remain enforced even when declared length is absent.
 */
export async function readBoundedPaymentJsonRequest(
  request: NextRequest,
): Promise<{ body: unknown } | { response: NextResponse }> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return { response: noStoreJson({ error: "Content-Type must be application/json." }, 415) };
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > PAYMENT_API_BODY_LIMIT)) {
    return { response: noStoreJson({ error: "Request body exceeds the payment request size limit." }, 413) };
  }
  if (!request.body) {
    return { response: noStoreJson({ error: "Invalid JSON body." }, 422) };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > PAYMENT_API_BODY_LIMIT) {
        await reader.cancel().catch(() => undefined);
        return { response: noStoreJson({ error: "Request body exceeds the payment request size limit." }, 413) };
      }
      chunks.push(value);
    }
  } catch {
    return { response: noStoreJson({ error: "Could not read payment request." }, 400) };
  } finally {
    reader.releaseLock();
  }
  if (!receivedBytes) {
    return { response: noStoreJson({ error: "Invalid JSON body." }, 422) };
  }
  try {
    const bytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { body: JSON.parse(source) as unknown };
  } catch {
    return { response: noStoreJson({ error: "Invalid JSON body." }, 422) };
  }
}

export function paymentApiError(error: unknown): NextResponse {
  if (!(error instanceof PaymentError)) return noStoreJson({ error: "Payment service is temporarily unavailable." }, 503);
  // Error messages may contain untrusted provider diagnostics or payer data.
  // Record only the stable safe code; detailed financial evidence belongs in
  // the restricted reconciliation/audit records, not general application logs.
  console.warn("PAYMENT_API_ERROR_CODE:", error.code);
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
    case "PAYSTACK_PAYER_EMAIL_REQUIRED":
    case "PAYMENT_PAYER_EMAIL_REQUIRED":
      return noStoreJson({ error: "A valid account email is required for card checkout." }, 422);
    case "PAYSTACK_NOT_CONFIGURED":
    case "PAYSTACK_CONFIGURATION_INVALID":
    case "PAYSTACK_PRODUCTION_NOT_READY":
    case "PAYMENT_PROVIDER_NOT_CONFIGURED":
    case "PAYMENT_PROVIDER_CONFIGURATION_INVALID":
    case "PAYMENT_PROVIDER_PRODUCTION_NOT_READY":
    case "PAYMENT_PROVIDER_UNAVAILABLE":
    case "PAYMENT_PROVIDER_AUTHENTICATION_FAILED":
      return noStoreJson({ error: "Card checkout is temporarily unavailable. Please contact KT Couriers support." }, 503);
    case "PAYMENT_PROVIDER_TIMEOUT":
      return noStoreJson({ error: "The payment provider did not respond. Check the payment's current status before retrying." }, 503);
    case "PAYMENT_PROVIDER_RATE_LIMITED":
      return noStoreJson({ error: "Card checkout is temporarily rate limited. Check payment status before retrying." }, 429);
    case "PAYMENT_PROVIDER_RESPONSE_INVALID":
    case "PAYMENT_PROVIDER_REDIRECT_INVALID":
      return noStoreJson({ error: "The card payment handoff could not be verified. Please contact KT Couriers support." }, 503);
    default:
      return noStoreJson({ error: "Payment request is invalid." }, 422);
  }
}
