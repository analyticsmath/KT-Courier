import { describe, expect, it } from "vitest";
import { createPayfastRecurringTokenVault, requirePayfastRecurringTokenVault } from "@/lib/subscriptions/providers/payfast-recurring-token-vault";

describe("subscription provider token storage", () => {
  it("stores only an encrypted opaque envelope and stable fingerprint", () => {
    const vault = createPayfastRecurringTokenVault(Buffer.alloc(32, 7));
    const encrypted = vault.encrypt("token_A1_123");
    expect(encrypted.encrypted).not.toContain("token_A1_123");
    expect(encrypted.fingerprint).toHaveLength(64);
    expect(vault.decrypt(encrypted.encrypted)).toBe("token_A1_123");
  });
  it("blocks provider authorization evidence persistence without a server-side key", () => {
    expect(() => requirePayfastRecurringTokenVault({})).toThrow(/PROVIDER_TOKEN_STORAGE_UNAVAILABLE/);
  });
});
