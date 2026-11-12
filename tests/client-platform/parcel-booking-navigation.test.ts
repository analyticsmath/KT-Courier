import { describe, expect, it } from "vitest";
import { parcelBookingDestination, parcelBookingStepHref } from "@/lib/client-platform/parcel-booking-navigation";

describe("secure parcel booking next step", () => {
  it("takes a booked consumer card payment straight to the server-authorized payment page", () => {
    expect(parcelBookingDestination({
      business: false, paymentMethod: "DIGITAL_ONLY", orderId: "order-123",
      orderNumber: "KT-2026-0001",
    })).toBe("/orders/KT-2026-0001/payment");
  });
  it("does the same for a store booking its own parcel delivery", () => {
    expect(parcelBookingDestination({
      business: true, paymentMethod: "DIGITAL_ONLY", orderId: "order-456",
      orderNumber: "KT-2026-0020",
    })).toBe("/orders/KT-2026-0020/payment");
  });
  it("takes an approved 50/50 deposit to the server-authorized payment page", () => {
    expect(parcelBookingDestination({
      business: true, paymentMethod: "DEPOSIT_PLUS_COD", orderId: "order-deposit",
      orderNumber: "KT-2026-DP01",
    })).toBe("/orders/KT-2026-DP01/payment");
  });
  it("keeps approved 100% cash-on-delivery bookings on their existing order detail page", () => {
    expect(parcelBookingDestination({
      business: false, paymentMethod: "FULL_COD", orderId: "order-123",
      orderNumber: "KT-2026-0001",
    })).toBe("/account/orders/order-123");
    expect(parcelBookingDestination({
      business: true, paymentMethod: "FULL_COD", orderId: "order-456",
      orderNumber: "KT-2026-0020",
    })).toBe("/store/orders/order-456");
  });
  it("falls back safely if an older server response lacks a public payment reference", () => {
    expect(parcelBookingDestination({
      business: false, paymentMethod: "DIGITAL_ONLY", orderId: "order-123",
    })).toBe("/account/orders/order-123");
  });
  it("encodes the reference as one path segment, not an arbitrary route", () => {
    expect(parcelBookingDestination({
      business: false, paymentMethod: "DIGITAL_ONLY", orderId: "order-123",
      orderNumber: "KT/2026?redirect=1",
    })).toBe("/orders/KT%2F2026%3Fredirect%3D1/payment");
  });
});


describe("dedicated quote-to-booking handoff", () => {
  it("keeps the quote identifier in a single encoded search parameter", () => {
    expect(parcelBookingStepHref("quote_test_123")).toBe("/quote/book?reference=quote_test_123");
    expect(parcelBookingStepHref("quote_test_123", true))
      .toBe("/quote/book?reference=quote_test_123&workspace=store");
    expect(parcelBookingStepHref("quote/x&continue=https://attacker.test"))
      .toBe("/quote/book?reference=quote%2Fx%26continue%3Dhttps%3A%2F%2Fattacker.test");
  });
});
