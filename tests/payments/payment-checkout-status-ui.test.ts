import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaymentCheckoutClient } from "@/components/payments/PaymentCheckoutClient";

const provider = { active: true, environment: "sandbox", blockReason: null };
const payment = {
  publicReference: "pay_test_0001",
  orderReference: "KT-2026-001",
  amount: "100.00",
  currency: "ZAR" as const,
  provider: "PAYSTACK" as const,
  updatedAt: "2026-11-12T10:00:00.000Z",
};

describe("courier payment processing UX", () => {
  it("makes the pending status refresh visible without offering a second provider charge", () => {
    const html = renderToStaticMarkup(createElement(PaymentCheckoutClient, {
      orderId: "order-001", orderReference: payment.orderReference,
      initialPayment: { ...payment, status: "PROCESSING" }, provider,
    }));
    expect(html).toContain("Check payment status");
    expect(html).toContain("Your payment is being verified with Paystack.");
    expect(html).toContain("disabled");
  });

  it("does not present an already verified payment as an available charge", () => {
    const html = renderToStaticMarkup(createElement(PaymentCheckoutClient, {
      orderId: "order-001", orderReference: payment.orderReference,
      initialPayment: { ...payment, status: "SUCCEEDED" }, provider,
    }));
    expect(html).toContain("Check payment status");
    expect(html).toContain("disabled");
    expect(html).toContain("Payment");
  });

  it("permits a new card checkout only on an uncharged eligible payment", () => {
    const html = renderToStaticMarkup(createElement(PaymentCheckoutClient, {
      orderId: "order-001", orderReference: payment.orderReference,
      initialPayment: null, provider,
    }));
    expect(html).toContain("Pay with Paystack");
    expect(html).not.toContain("Check payment status");
  });
});
