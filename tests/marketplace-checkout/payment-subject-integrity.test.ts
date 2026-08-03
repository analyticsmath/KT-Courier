import { describe, expect, it } from "vitest";
import { assertPaymentSubjectIntegrity, marketplacePaymentSubject } from "@/lib/payments/payment-subject-policy";

describe("marketplace payment subject integrity", () => {
  it("accepts a courier payment with exactly one authenticated courier subject", () => {
    expect(() => assertPaymentSubjectIntegrity({ subjectType: "COURIER_ORDER", userId: "user-1", orderId: "order-1", marketplaceCheckoutId: null, marketplaceOrderId: null })).not.toThrow();
  });
  it("accepts authenticated and guest marketplace payment subjects", () => {
    expect(() => marketplacePaymentSubject({ checkoutId: "checkout-1", customerUserId: "user-1", guestAccessTokenHash: null })).not.toThrow();
    expect(() => marketplacePaymentSubject({ checkoutId: "checkout-2", customerUserId: null, guestAccessTokenHash: "secure-hash" })).not.toThrow();
  });
  it("rejects no subject, dual subject, courier without user, and guest without evidence", () => {
    const invalid = [
      { subjectType: "MARKETPLACE_CHECKOUT" as const, userId: null, orderId: null, marketplaceCheckoutId: null },
      { subjectType: "MARKETPLACE_CHECKOUT" as const, userId: "user-1", orderId: "order-1", marketplaceCheckoutId: "checkout-1", checkoutCustomerUserId: "user-1" },
      { subjectType: "COURIER_ORDER" as const, userId: null, orderId: "order-1", marketplaceCheckoutId: null },
      { subjectType: "MARKETPLACE_CHECKOUT" as const, userId: null, orderId: null, marketplaceCheckoutId: "checkout-1", checkoutCustomerUserId: null, checkoutGuestAccessTokenHash: null },
    ];
    for (const value of invalid) expect(() => assertPaymentSubjectIntegrity(value)).toThrow();
  });
  it("rejects a marketplace order from a different checkout", () => {
    expect(() => assertPaymentSubjectIntegrity({ subjectType: "MARKETPLACE_CHECKOUT", userId: "user-1", orderId: null, marketplaceCheckoutId: "checkout-1", marketplaceOrderId: "market-order-2", checkoutCustomerUserId: "user-1", checkoutGuestAccessTokenHash: null, marketplaceOrderCheckoutId: "checkout-2" })).toThrow();
  });
});
