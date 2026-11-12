import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParcelBookedNextStep } from "@/components/forms/ParcelBookedNextStep";
import { parcelBookingDestination } from "@/lib/client-platform/parcel-booking-navigation";

describe("successful parcel booking continuation", () => {
  it("shows an actionable, owner-authorized payment destination without falsely claiming payment success", () => {
    const href = parcelBookingDestination({ business: false, paymentMethod: "DIGITAL_ONLY", orderId: "id-123", orderNumber: "KT-2026-0005" });
    const html = renderToStaticMarkup(createElement(ParcelBookedNextStep, { href, paymentMethod: "DIGITAL_ONLY" }));
    expect(html).toContain('href="/orders/KT-2026-0005/payment"');
    expect(html).toContain("Continue to secure card payment");
    expect(html).toContain("Payment is not yet confirmed.");
    expect(html).not.toContain("Payment successful");
  });
  it("keeps a store parcel's deposit requirement on the same canonical payment page", () => {
    const href = parcelBookingDestination({ business: true, paymentMethod: "DEPOSIT_PLUS_COD", orderId: "id-456", orderNumber: "KT-2026-0012" });
    const html = renderToStaticMarkup(createElement(ParcelBookedNextStep, { href, paymentMethod: "DEPOSIT_PLUS_COD" }));
    expect(html).toContain('href="/orders/KT-2026-0012/payment"');
    expect(html).toContain("Payment is not yet confirmed.");
  });
  it("keeps fully COD-funded bookings on their own order detail, without a card handoff", () => {
    const href = parcelBookingDestination({ business: true, paymentMethod: "FULL_COD", orderId: "id-789", orderNumber: "KT-2026-0020" });
    const html = renderToStaticMarkup(createElement(ParcelBookedNextStep, { href, paymentMethod: "FULL_COD" }));
    expect(html).toContain('href="/store/orders/id-789"');
    expect(html).toContain("View parcel booking");
    expect(html).not.toContain("Continue to secure card payment");
  });
});
