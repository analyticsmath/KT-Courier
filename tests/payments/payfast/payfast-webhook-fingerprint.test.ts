import { describe, expect, it } from "vitest";
import { fingerprintPayfastWebhook } from "@/lib/payments/providers/payfast/payfast-webhook-fingerprint";

describe("Payfast webhook fingerprint", () => {
  it("is deterministic for exact bytes and environment", () => {
    const body = new TextEncoder().encode("a=1&b=2");
    expect(fingerprintPayfastWebhook("SANDBOX", body)).toBe(fingerprintPayfastWebhook("SANDBOX", body));
    expect(fingerprintPayfastWebhook("SANDBOX", body)).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintPayfastWebhook("PRODUCTION", body)).not.toBe(fingerprintPayfastWebhook("SANDBOX", body));
    expect(fingerprintPayfastWebhook("SANDBOX", new TextEncoder().encode("b=2&a=1"))).not.toBe(fingerprintPayfastWebhook("SANDBOX", body));
  });
});
