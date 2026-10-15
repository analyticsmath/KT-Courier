import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckoutPaymentSummary } from "@/components/public-v2/commerce/CheckoutPaymentSummary";
describe("checkout payment schedule", () => {
  it("explains both amounts to the buyer before they authorize a deposit", () => {
    const html = renderToStaticMarkup(createElement(CheckoutPaymentSummary, { digitalRequired: "60.00", cashRequired: "60.01" }));
    expect(html).toContain("Pay online today");
    expect(html).toContain("Cash due on delivery");
    expect(html).toMatch(/60[,.]00/);
    expect(html).toMatch(/60[,.]01/);
  });
  it("does not show a cash obligation for prepaid checkout", () => {
    expect(renderToStaticMarkup(createElement(CheckoutPaymentSummary, { digitalRequired: "120.00", cashRequired: "0.00" }))).toBe("");
  });
});
