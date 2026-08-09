import { PaymentError } from "@/lib/payments/errors";
import { beginPayfastItnRequest } from "@/lib/payments/providers/payfast/payfast-itn-rate-limit";
import { observePayfastItn } from "@/lib/payments/providers/payfast/payfast-itn-observability";
import { readBoundedPayfastItnBody } from "@/lib/payments/providers/payfast/payfast-itn-transport";
import {
  applyVerifiedPayfastItn,
  recordPayfastVerificationFailure,
} from "@/lib/services/payfast-itn-application.service";
import {
  PayfastItnVerificationFailure,
  verifyPayfastItn,
} from "@/lib/services/payfast-itn-verification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
});

function text(body: "OK" | "INVALID" | "RETRY", status: number): Response {
  return new Response(body, { status, headers: RESPONSE_HEADERS });
}

function failureResponse(error: PaymentError): Response {
  if (error.retryable || [
    "PAYFAST_SOURCE_ADDRESS_UNAVAILABLE",
    "PAYFAST_SOURCE_DNS_UNAVAILABLE",
    "PAYFAST_CONFIRMATION_UNAVAILABLE",
    "PAYFAST_APPLICATION_UNAVAILABLE",
  ].includes(error.code)) return text("RETRY", 503);
  if (["PAYFAST_SOURCE_ADDRESS_INVALID", "PAYFAST_SOURCE_NOT_ALLOWED"].includes(error.code)) return text("INVALID", 403);
  if (["PAYFAST_AMOUNT_MISMATCH", "PAYFAST_MERCHANT_MISMATCH", "PAYFAST_CREDENTIAL_VERSION_MISMATCH"].includes(error.code)) return text("INVALID", 422);
  if (["PAYFAST_EVENT_CONFLICT", "PAYMENT_PROVIDER_REFERENCE_CONFLICT"].includes(error.code)) return text("INVALID", 409);
  return text("INVALID", 400);
}

function observeFailure(error: PaymentError, durationMs: number): void {
  const metric = error.code === "PAYFAST_AMOUNT_MISMATCH"
    ? "amount_mismatch"
    : error.code === "PAYFAST_CONFIRMATION_UNAVAILABLE"
      ? "provider_confirmation_unavailable"
      : ["PAYFAST_SOURCE_ADDRESS_INVALID", "PAYFAST_SOURCE_ADDRESS_UNAVAILABLE", "PAYFAST_SOURCE_DNS_UNAVAILABLE", "PAYFAST_SOURCE_NOT_ALLOWED"].includes(error.code)
        ? "rejected_source"
        : error.code === "PAYFAST_ITN_SIGNATURE_INVALID"
          ? "rejected_signature"
          : "rejected_transport";
  observePayfastItn(metric, { durationMs, safeErrorCode: error.code });
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();
  let release: (() => void) | null = null;
  try {
    release = beginPayfastItnRequest();
    observePayfastItn("received");
    const body = await readBoundedPayfastItnBody(request);
    const result = await verifyPayfastItn({ bodyBytes: body.bytes, bodyText: body.text, headers: request.headers });
    if (result.kind === "EXISTING") {
      if (["APPLIED", "DUPLICATE", "IGNORED_STALE"].includes(result.processingStatus)) {
        observePayfastItn("duplicate", { processingStatus: result.processingStatus, durationMs: Date.now() - startedAt });
        return text("OK", 200);
      }
      if (result.processingStatus === "RECONCILIATION_REQUIRED") {
        observePayfastItn("reconciliation_required", { processingStatus: result.processingStatus, durationMs: Date.now() - startedAt });
        return text("INVALID", 409);
      }
      observePayfastItn("rejected_transport", { processingStatus: result.processingStatus, durationMs: Date.now() - startedAt, safeErrorCode: "PAYFAST_EVENT_NOT_TERMINAL" });
      return text("INVALID", 400);
    }
    observePayfastItn("verified", { environment: result.receipt.environment, normalizedStatus: result.receipt.normalizedStatus });
    // The transaction persists PAYMENT_SUCCEEDED_VERIFIED for an out-of-band,
    // idempotent processor. This HTTP boundary never finalizes marketplace
    // orders or activates subscriptions.
    const application = await applyVerifiedPayfastItn(result);
    if (application.outcome === "RECONCILIATION_REQUIRED") {
      observePayfastItn("reconciliation_required", { eventPublicReference: application.eventPublicReference, durationMs: Date.now() - startedAt });
      return text("INVALID", 409);
    }
    observePayfastItn(
      application.outcome === "DUPLICATE" ? "duplicate" : application.outcome === "IGNORED_STALE" ? "ignored_stale" : "applied",
      { eventPublicReference: application.eventPublicReference, durationMs: Date.now() - startedAt },
    );
    return text("OK", 200);
  } catch (error) {
    if (error instanceof PayfastItnVerificationFailure) {
      try {
        await recordPayfastVerificationFailure(error);
      } catch {
        observePayfastItn("provider_confirmation_unavailable", { durationMs: Date.now() - startedAt, safeErrorCode: "PAYFAST_FAILURE_RECEIPT_UNAVAILABLE" });
        return text("RETRY", 503);
      }
      observeFailure(error, Date.now() - startedAt);
      return failureResponse(error);
    }
    if (error instanceof PaymentError) {
      observeFailure(error, Date.now() - startedAt);
      return failureResponse(error);
    }
    observePayfastItn("rejected_transport", { durationMs: Date.now() - startedAt, safeErrorCode: "PAYFAST_UNEXPECTED_FAILURE" });
    return text("RETRY", 503);
  } finally {
    release?.();
  }
}
