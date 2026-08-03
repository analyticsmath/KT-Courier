import { describe, expect, it } from "vitest";
import { normalizePayfastSourceAddress, resolvePayfastSourceAddress } from "@/lib/payments/providers/payfast/payfast-source-address";

describe("Payfast source-address trust", () => {
  it("fails direct mode closed when the runtime has no peer address", () => expect(() => resolvePayfastSourceAddress({ mode: "direct", headers: new Headers() })).toThrow());
  it("uses only the KT canonical header in trusted-proxy mode", () => {
    const headers = new Headers({ "x-kt-source-ip": "196.1.2.3", "x-forwarded-for": "8.8.8.8", "x-real-ip": "9.9.9.9" });
    expect(resolvePayfastSourceAddress({ mode: "single_trusted_proxy", headers })).toBe("196.1.2.3");
    expect(() => resolvePayfastSourceAddress({ mode: "single_trusted_proxy", headers: new Headers({ "x-forwarded-for": "196.1.2.3" }) })).toThrow();
  });
  it("normalizes IPv4-mapped IPv6 and bracketed IPv6", () => {
    expect(normalizePayfastSourceAddress("::ffff:196.1.2.3")).toBe("196.1.2.3");
    expect(normalizePayfastSourceAddress("[2001:db8::1]")).toBe("2001:db8::1");
  });
  it.each(["127.0.0.1", "10.0.0.1", "::1", "::", "196.1.2.3:443", "196.1.2.3, 8.8.8.8"])("rejects special, ported, or multiple address %s", (value) => expect(() => normalizePayfastSourceAddress(value)).toThrow());
});
