import { describe, expect, it } from "vitest";
import { sanitizeProviderSnapshot } from "@/lib/payments/provider-snapshot-policy";

describe("payment provider snapshot normalization", () => {
  it("sorts objects and recursively redacts secret-like keys", () => expect(sanitizeProviderSnapshot({ z: 1, nested: { token: "no", ok: true } })).toEqual({ nested: { ok: true, token: "[REDACTED]" }, z: 1 }));
  it("rejects oversized or deeply nested data", () => expect(() => sanitizeProviderSnapshot({ a: { b: { c: { d: { e: { f: 1 } } } } } })).toThrow());
});

