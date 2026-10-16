import { describe, expect, it } from "vitest";
import {
  assertCartMutable,
  assertSupportedQuantity,
  MAX_CART_LINES,
  MAX_CART_STORES,
  MAX_LINE_QUANTITY,
  MARKETPLACE_CURRENCY,
  CART_TERMINAL_STATUSES,
} from "@/lib/marketplace-checkout/policy";

describe("Phase 20 Marketplace Cart Policy Integration Tests", () => {
  it("enforces South African Rand (ZAR) as the sole marketplace currency", () => {
    expect(MARKETPLACE_CURRENCY).toBe("ZAR");
  });

  it("enforces cart line and store constraints", () => {
    expect(MAX_CART_LINES).toBe(60);
    expect(MAX_CART_STORES).toBe(12);
    expect(MAX_LINE_QUANTITY).toBe(99);
  });

  it("validates line quantity bounds strictly", () => {
    expect(() => assertSupportedQuantity(1)).not.toThrow();
    expect(() => assertSupportedQuantity(99)).not.toThrow();

    expect(() => assertSupportedQuantity(0)).toThrowError(/CART_QUANTITY_INVALID/);
    expect(() => assertSupportedQuantity(-1)).toThrowError(/CART_QUANTITY_INVALID/);
    expect(() => assertSupportedQuantity(100)).toThrowError(/CART_QUANTITY_INVALID/);
    expect(() => assertSupportedQuantity(1.5)).toThrowError(/CART_QUANTITY_INVALID/);
    expect(() => assertSupportedQuantity("5")).toThrowError(/CART_QUANTITY_INVALID/);
  });

  it("prevents mutation on terminal and locked carts", () => {
    expect(() => assertCartMutable("ACTIVE")).not.toThrow();

    for (const status of Array.from(CART_TERMINAL_STATUSES)) {
      expect(() => assertCartMutable(status)).toThrowError(/CART_MUTATION_NOT_ALLOWED/);
    }
    expect(() => assertCartMutable("CHECKOUT_LOCKED")).toThrowError(/CART_MUTATION_NOT_ALLOWED/);
  });
});
