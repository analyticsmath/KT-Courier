import { describe, expect, it } from "vitest";
import { providerSnapshotContainsSensitiveKey, sanitizeProviderSnapshot } from "@/lib/payments/provider-snapshot-policy";
describe("provider snapshot safety", () => {
  it("detects and redacts credential-like fields", () => { expect(providerSnapshotContainsSensitiveKey({ merchant_key: "x" })).toBe(true); expect(sanitizeProviderSnapshot({ merchant_key: "x" })).toEqual({ merchant_key: "[REDACTED]" }); });
  it("keeps safe normalized evidence", () => expect(sanitizeProviderSnapshot({ status: "PENDING", amount: "1.00" })).toEqual({ amount: "1.00", status: "PENDING" }));
});

