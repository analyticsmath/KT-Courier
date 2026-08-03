import { RefundError } from "../errors";
import type { ProviderRefundResult, RefundProviderResultStatus } from "./refund-provider-adapter";

const SAFE_REFERENCE = /^[A-Za-z0-9_.:-]{1,160}$/;
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,80}$/;
const STATUSES = new Set<RefundProviderResultStatus>(["SUCCEEDED", "PROCESSING", "FAILED", "UNKNOWN"]);

export function validateRefundProviderResult(result: ProviderRefundResult): ProviderRefundResult {
  if (!result || typeof result !== "object" || !STATUSES.has(result.status) || typeof result.definitive !== "boolean") {
    throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Refund provider returned an invalid result.");
  }
  if (result.providerRefundId && !SAFE_REFERENCE.test(result.providerRefundId)) throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Provider refund reference is invalid.");
  if (result.providerPaymentId && !SAFE_REFERENCE.test(result.providerPaymentId)) throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Provider payment reference is invalid.");
  if (result.providerStatusCode && !SAFE_CODE.test(result.providerStatusCode)) throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Provider status code is invalid.");
  if (result.status === "SUCCEEDED" && (!result.definitive || !result.providerRefundId)) throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Provider success is not authoritative or lacks a refund reference.");
  if (result.status === "FAILED" && !result.definitive) throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Provider failure is not definitive.");
  if (result.status === "UNKNOWN" && result.definitive) throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Unknown provider result cannot be definitive.");
  return Object.freeze({ ...result, safeMetadata: result.safeMetadata ? Object.freeze({ ...result.safeMetadata }) : undefined });
}

export function unknownRefundProviderResult(error: unknown): ProviderRefundResult {
  const timeout = (error as { name?: string })?.name === "AbortError";
  return Object.freeze({
    status: "UNKNOWN",
    providerStatusCode: timeout ? "PROVIDER_CALL_TIMEOUT" : "PROVIDER_OUTCOME_UNKNOWN",
    safeMetadata: Object.freeze({ failureCategory: timeout ? "TIMEOUT" : error instanceof TypeError ? "NETWORK" : "UNKNOWN_OUTCOME" }),
    definitive: false,
  });
}

