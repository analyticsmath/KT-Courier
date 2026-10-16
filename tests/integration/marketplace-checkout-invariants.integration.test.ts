import { describe, expect, it } from "vitest";
import {
  CHECKOUT_TERMINAL_STATUSES,
  mayTransitionCheckout,
  assertCheckoutTransition,
  type CheckoutStatus,
} from "@/lib/marketplace-checkout/policy";

describe("Phase 20 Marketplace Checkout Invariants Integration Tests", () => {
  it("enforces terminal checkout states have no outgoing transitions", () => {
    for (const status of Array.from(CHECKOUT_TERMINAL_STATUSES)) {
      expect(mayTransitionCheckout(status as CheckoutStatus, "CREATED")).toBe(false);
      expect(mayTransitionCheckout(status as CheckoutStatus, "COMPLETED")).toBe(false);
      expect(mayTransitionCheckout(status as CheckoutStatus, "CANCELLED")).toBe(false);
    }
  });

  it("enforces canonical forward progression from CREATED through to COMPLETED", () => {
    expect(mayTransitionCheckout("CREATED", "VALIDATING")).toBe(true);
    expect(mayTransitionCheckout("VALIDATING", "READY_FOR_REVIEW")).toBe(true);
    expect(mayTransitionCheckout("READY_FOR_REVIEW", "RESERVING")).toBe(true);
    expect(mayTransitionCheckout("RESERVING", "RESERVED")).toBe(true);
    expect(mayTransitionCheckout("RESERVED", "PAYMENT_PREPARING")).toBe(true);
    expect(mayTransitionCheckout("PAYMENT_PREPARING", "PAYMENT_PENDING")).toBe(true);
    expect(mayTransitionCheckout("PAYMENT_PENDING", "PAYMENT_CONFIRMED")).toBe(true);
    expect(mayTransitionCheckout("PAYMENT_CONFIRMED", "COMPLETING")).toBe(true);
    expect(mayTransitionCheckout("COMPLETING", "COMPLETED")).toBe(true);
  });

  it("throws on illegal backwards or skipped state transitions", () => {
    expect(() => assertCheckoutTransition("CREATED", "COMPLETED")).toThrowError(/CHECKOUT_TRANSITION_INVALID/);
    expect(() => assertCheckoutTransition("COMPLETED", "CREATED")).toThrowError(/CHECKOUT_TRANSITION_INVALID/);
    expect(() => assertCheckoutTransition("PAYMENT_PENDING", "READY_FOR_REVIEW")).toThrowError(/CHECKOUT_TRANSITION_INVALID/);
  });

  it("asserts reconciliation paths for intermediate live states", () => {
    expect(mayTransitionCheckout("RESERVING", "RECONCILIATION_REQUIRED")).toBe(true);
    expect(mayTransitionCheckout("RESERVED", "RECONCILIATION_REQUIRED")).toBe(true);
    expect(mayTransitionCheckout("PAYMENT_PENDING", "RECONCILIATION_REQUIRED")).toBe(true);
    expect(mayTransitionCheckout("RECONCILIATION_REQUIRED", "COMPLETING")).toBe(true);
    expect(mayTransitionCheckout("RECONCILIATION_REQUIRED", "CANCELLED")).toBe(true);
  });
});
