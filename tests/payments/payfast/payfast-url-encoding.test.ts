import { describe, expect, it } from "vitest";
import { payfastUrlEncode } from "@/lib/payments/providers/payfast/payfast-url-encoding";

describe("Payfast PHP-compatible URL encoding", () => {
  it.each([
    ["a b", "a+b"], ["+&=/", "%2B%26%3D%2F"], ["'\"()~%", "%27%22%28%29%7E%25"],
    ["safe-_.AZaz09", "safe-_.AZaz09"], ["Jöhn", "J%C3%B6hn"], ["南非", "%E5%8D%97%E9%9D%9E"],
  ])("encodes %s exactly", (input, expected) => expect(payfastUrlEncode(input)).toBe(expected));
  it("does not double encode percent text", () => expect(payfastUrlEncode("%2F")).toBe("%252F"));
});
