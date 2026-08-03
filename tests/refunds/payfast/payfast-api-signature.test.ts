import { describe, expect, it } from "vitest";
import { buildPayfastApiHeaders, buildPayfastApiSignatureBase, generatePayfastApiSignature } from "@/lib/refunds/providers/payfast/payfast-api-signature";

const input = { headers: { "merchant-id": "10000100", version: "v1" as const, timestamp: "2026-07-18T10:11:12.000Z" }, body: { reason: "KT_COURIERS_SERVICE_FAILURE", notify_buyer: "0", amount: "12.34" }, passphrase: "s3cret value" };
describe("Payfast Refund API signature", () => {
  it("sorts every field, includes the passphrase, and PHP-encodes values", () => expect(buildPayfastApiSignatureBase(input)).toBe("amount=12.34&merchant-id=10000100&notify_buyer=0&passphrase=s3cret+value&reason=KT_COURIERS_SERVICE_FAILURE&timestamp=2026-07-18T10%3A11%3A12.000Z&version=v1"));
  it("matches the fixed lowercase MD5 request vector", () => expect(generatePayfastApiSignature(input)).toBe("1221235e77c207f800701112648f152a"));
  it("reuses the exact caller timestamp in the header and signature", () => {
    const headers = buildPayfastApiHeaders({ merchantId: "10000100", passphrase: "s3cret value", timestamp: input.headers.timestamp, body: input.body });
    expect(headers).toEqual({ "merchant-id": "10000100", version: "v1", timestamp: input.headers.timestamp, signature: "1221235e77c207f800701112648f152a" });
  });
  it("rejects key collisions across headers, query and body", () => expect(() => buildPayfastApiSignatureBase({ ...input, body: { timestamp: "different" } })).toThrow(/invalid/i));
});
