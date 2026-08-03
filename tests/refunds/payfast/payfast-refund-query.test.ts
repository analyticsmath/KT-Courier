import { describe, expect, it } from "vitest";
import { PayfastRefundAdapter, PAYFAST_REFUND_CAPABILITIES } from "@/lib/refunds/providers/payfast/payfast-refund-adapter";

const config = { merchantId: "10000100", passphrase: "secret", credentialVersion: "v1", apiOrigin: "https://api.payfast.co.za", apiVersion: "v1" } as const;
describe("Payfast refund query", () => {
  it("does not guess between repository-unresolved query routes", async () => {
    expect(PAYFAST_REFUND_CAPABILITIES.supportsStatusQuery).toBe(false);
    const result = await new PayfastRefundAdapter(config).queryRefund({ refundPublicReference: "R-1", providerRefundId: "PF-R-1" }, { signal: new AbortController().signal, correlationId: "query", timeoutMs: 1000 });
    expect(result).toEqual({ status: "UNKNOWN", providerStatusCode: "PAYFAST_QUERY_PROTOCOL_UNRESOLVED", safeMetadata: { protocolMappingReviewed: false }, definitive: false });
  });
});
