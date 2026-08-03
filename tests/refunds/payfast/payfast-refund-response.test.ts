import { describe, expect, it } from "vitest";
import { normalizePayfastRefundResponse } from "@/lib/refunds/providers/payfast/payfast-refund-response";

describe("Payfast refund response", () => {
  it("retains only safe evidence and maps unreviewed semantics to UNKNOWN", () => expect(normalizePayfastRefundResponse({ id: "PF-R-1", status: "complete", extra: { secret: "discard" } }, 200)).toEqual({ status: "UNKNOWN", providerRefundId: "PF-R-1", providerStatusCode: "HTTP_200", safeProviderStatus: "complete", safeMetadata: { protocolMappingReviewed: false }, definitive: false }));
  it("rejects malformed bodies", () => expect(() => normalizePayfastRefundResponse("raw body", 500)).toThrow(/malformed/i));
  it("excludes raw provider responses", () => expect(JSON.stringify(normalizePayfastRefundResponse({ id: "PF-R-1", signature: "secret", customer_email: "a@example.test" }, 202))).not.toMatch(/secret|example\.test|signature/));
});
