import { describe, expect, it } from "vitest";
import { validateProviderRedirectUrl } from "@/lib/payments/redirect-url-policy";

describe("provider redirect URL policy", () => {
  it("accepts allowlisted HTTPS", () => expect(validateProviderRedirectUrl("https://pay.example.test/session", ["pay.example.test"])).toBe("https://pay.example.test/session"));
  it.each(["https://other.test/x", "http://pay.example.test/x", "javascript:alert(1)", "data:text/plain,x", "https://user:pass@pay.example.test/x"])("rejects unsafe URL %s", (url) => expect(() => validateProviderRedirectUrl(url, ["pay.example.test"])).toThrow());
  it("rejects oversized URLs", () => expect(() => validateProviderRedirectUrl(`https://pay.example.test/${"a".repeat(2050)}`, ["pay.example.test"])).toThrow());
});

