import { RefundError } from "../../errors";
import type { ProviderRefundResult } from "../refund-provider-adapter";

const SAFE_REFERENCE = /^[A-Za-z0-9_.:-]{1,160}$/;
const SAFE_STATUS = /^[A-Za-z0-9_. -]{1,80}$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Payfast returned a malformed refund response.");
  }
  return value as Record<string, unknown>;
}

function safeString(value: unknown, pattern: RegExp): string | undefined {
  return typeof value === "string" && pattern.test(value) ? value : undefined;
}

export function normalizePayfastRefundResponse(value: unknown, httpStatus: number): ProviderRefundResult {
  const response = record(value);
  const providerRefundId = safeString(response.id ?? response.refund_id, SAFE_REFERENCE);
  const safeProviderStatus = safeString(response.status, SAFE_STATUS);
  // Repository-visible material does not establish authoritative Payfast Refund
  // API status semantics. Preserve safe evidence and fail closed as UNKNOWN.
  return Object.freeze({
    status: "UNKNOWN",
    ...(providerRefundId ? { providerRefundId } : {}),
    providerStatusCode: `HTTP_${httpStatus}`,
    ...(safeProviderStatus ? { safeProviderStatus } : {}),
    safeMetadata: Object.freeze({ protocolMappingReviewed: false }),
    definitive: false,
  });
}

