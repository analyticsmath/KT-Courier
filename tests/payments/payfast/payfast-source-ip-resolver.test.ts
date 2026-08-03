import { describe, expect, it, vi } from "vitest";
import { PayfastSourceIpResolver } from "@/lib/payments/providers/payfast/payfast-source-ip-resolver";

describe("dynamic Payfast source IP resolver", () => {
  it("uses deterministic A/AAAA answers and verifies membership", async () => {
    const resolver = new PayfastSourceIpResolver({ resolve4: vi.fn().mockResolvedValue([{ address: "196.1.2.3", ttl: 60 }]), resolve6: vi.fn().mockResolvedValue([{ address: "2001:db8::1", ttl: 60 }]) }, () => 0);
    await expect(resolver.verify("SANDBOX", "196.1.2.3")).resolves.toBeUndefined();
    await expect(resolver.verify("SANDBOX", "196.1.2.4")).rejects.toMatchObject({ code: "PAYFAST_SOURCE_NOT_ALLOWED" });
  });
  it("uses a bounded stale grace then fails closed", async () => {
    let now = 0;
    const dns = { resolve4: vi.fn().mockResolvedValueOnce([{ address: "196.1.2.3", ttl: 30 }]).mockRejectedValue(new Error("dns")), resolve6: vi.fn().mockRejectedValue(new Error("no AAAA")) };
    const resolver = new PayfastSourceIpResolver(dns, () => now);
    expect(await resolver.resolve("SANDBOX")).toContain("196.1.2.3");
    now = 31_000;
    expect(await resolver.resolve("SANDBOX")).toContain("196.1.2.3");
    now = 91_001;
    await expect(resolver.resolve("SANDBOX")).rejects.toMatchObject({ code: "PAYFAST_SOURCE_DNS_UNAVAILABLE", retryable: true });
  });
  it("refreshes before TTL expiry and retains the bounded current set", async () => {
    let now = 0;
    const resolve4 = vi.fn().mockResolvedValue([{ address: "196.1.2.3", ttl: 100 }]);
    const resolver = new PayfastSourceIpResolver({ resolve4, resolve6: vi.fn().mockRejectedValue(new Error("no AAAA")) }, () => now);
    await resolver.resolve("SANDBOX");
    now = 79_000;
    await resolver.resolve("SANDBOX");
    expect(resolve4).toHaveBeenCalledTimes(1);
    now = 81_000;
    await resolver.resolve("SANDBOX");
    expect(resolve4).toHaveBeenCalledTimes(2);
  });
  it("fails when a pinned host has no usable records", async () => {
    const resolver = new PayfastSourceIpResolver({ resolve4: vi.fn().mockRejectedValue(new Error("dns")), resolve6: vi.fn().mockRejectedValue(new Error("dns")) });
    await expect(resolver.resolve("SANDBOX")).rejects.toMatchObject({ code: "PAYFAST_SOURCE_DNS_UNAVAILABLE" });
  });
});
