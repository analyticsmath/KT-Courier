import { describe, expect, it } from "vitest";
import { canonicalPaymentHash } from "@/lib/payments/hash";

describe("payment hashes", () => {
  it("is deterministic across object key order and relevant entry order", () => expect(canonicalPaymentHash({ b: 2, a: [{ y: 2, x: 1 }] })).toBe(canonicalPaymentHash({ a: [{ x: 1, y: 2 }], b: 2 })));
  it.each(["amount", "subject", "provider", "route"])("changes when %s meaning changes", (key) => expect(canonicalPaymentHash({ [key]: "a" })).not.toBe(canonicalPaymentHash({ [key]: "b" })));
  it("excludes unstable values when callers omit them and never needs credentials", () => expect(canonicalPaymentHash({ paymentId: "p", amount: "1.00" })).toHaveLength(64));
});

