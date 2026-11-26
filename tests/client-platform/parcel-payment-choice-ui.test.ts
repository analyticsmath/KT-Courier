import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParcelPaymentChoice } from "@/components/forms/ParcelPaymentChoice";

const base = { total: "205.85", value: "DIGITAL_ONLY" as const, onChange: () => {} };

describe("parcel payment choice UX", () => {
  it("never renders retired 100% FULL_COD and presents online vs 50/50 split cleanly", () => {
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, {
      ...base,
      cod: { eligible: true, amountDueAtDelivery: "102.92" },
      authorizedMethods: [{ mode: "DEPOSIT_PLUS_COD", digitalRequired: "102.93", cashRequired: "102.92" }],
    }));
    expect(html).toContain("Card / online payment");
    expect(html).toContain("50% online deposit + 50% cash on delivery");
    expect(html).not.toContain('value="FULL_COD"');
    expect(html).not.toContain('value="DEPOSIT_PLUS_COD" disabled');
  });

  it("explains COD approval or eligibility without offering an unsafe selection", () => {
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, {
      ...base,
      cod: { eligible: false, amountDueAtDelivery: "205.85", reasonCode: "APPROVAL_PENDING", message: "Awaiting operational approval." },
    }));
    expect(html).toContain("50% online deposit + 50% cash on delivery");
    expect(html).toContain("Awaiting operational approval.");
    expect(html).toMatch(/<input[^>]*disabled[^>]*value="DEPOSIT_PLUS_COD"/);
  });

  it("muted disabled cash split cannot masquerade as a selectable active payment card", () => {
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, {
      ...base,
      cod: { eligible: false, amountDueAtDelivery: "102.92", message: "Awaiting independent policy approval." },
    }));
    expect(html).toMatch(/class="block text-base font-semibold text-\[var\(--kt-public-text-muted-on-surface\)\]">50% online deposit \+ 50% cash on delivery/);
    const enabled = renderToStaticMarkup(createElement(ParcelPaymentChoice, {
      ...base,
      cod: { eligible: true, amountDueAtDelivery: "102.92" },
      authorizedMethods: [{ mode: "DEPOSIT_PLUS_COD", digitalRequired: "102.93", cashRequired: "102.92" }],
    }));
    expect(enabled).toMatch(/class="block text-base font-semibold text-\[var\(--kt-brand-navy\)\]">50% online deposit \+ 50% cash on delivery/);
  });

  it("renders 50/50 deposit as selectable only with exact server authorization", () => {
    const authorizedMethods = [{ mode: "DEPOSIT_PLUS_COD", digitalRequired: "102.93", cashRequired: "102.92" }];
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, {
      ...base, value: "DEPOSIT_PLUS_COD", authorizedMethods,
      cod: { eligible: true, amountDueAtDelivery: "102.92" },
    }));
    expect(html).toContain("R 102.93 now + R 102.92 cash");
    expect(html).toMatch(/<input[^>]*checked[^>]*value="DEPOSIT_PLUS_COD"/);
    const denied = renderToStaticMarkup(createElement(ParcelPaymentChoice, {
      ...base, value: "DEPOSIT_PLUS_COD", authorizedMethods: [],
      cod: { eligible: true, amountDueAtDelivery: "102.92" },
    }));
    expect(denied).toMatch(/<input[^>]*disabled[^>]*value="DEPOSIT_PLUS_COD"/);
  });

  it("never treats cash as available while the authoritative method lookup is loading", () => {
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, { ...base, loading: true }));
    expect(html).toContain("Checking cash availability");
    expect(html).toMatch(/<input[^>]*disabled[^>]*value="DEPOSIT_PLUS_COD"/);
  });
});
