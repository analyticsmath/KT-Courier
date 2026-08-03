import { describe, expect, it } from "vitest";
import { parsePayfastItnForm, PAYFAST_ITN_FORM_LIMITS } from "@/lib/payments/providers/payfast/payfast-itn-parser";

describe("strict ordered Payfast ITN parser", () => {
  it("preserves exact field order, empty values, plus spaces, percent encoding, and Unicode", () => {
    const parsed = parsePayfastItnForm("first=one+two&empty=&unicode=%E2%82%AC&signature=abc&last=%C3%A9");
    expect(parsed.orderedFields).toEqual([
      { key: "first", value: "one two", index: 0 }, { key: "empty", value: "", index: 1 },
      { key: "unicode", value: "€", index: 2 }, { key: "signature", value: "abc", index: 3 }, { key: "last", value: "é", index: 4 },
    ]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.orderedFields)).toBe(true);
  });
  it.each(["a=%", "a=%0", "a=%GG", "a=%C3%28", "=empty", "a=1&a=2", "__proto__=x", "constructor=x", "a[b]=x", "a.b=x", "nul=%00"])("rejects malformed or unsafe form %s", (body) => expect(() => parsePayfastItnForm(body)).toThrow());
  it("rejects excessive fields and oversized values", () => {
    expect(() => parsePayfastItnForm(Array.from({ length: PAYFAST_ITN_FORM_LIMITS.maximumFields + 1 }, (_, index) => `f${index}=x`).join("&"))).toThrow();
    expect(() => parsePayfastItnForm(`value=${"x".repeat(PAYFAST_ITN_FORM_LIMITS.maximumValueLength + 1)}`)).toThrow();
  });
});
