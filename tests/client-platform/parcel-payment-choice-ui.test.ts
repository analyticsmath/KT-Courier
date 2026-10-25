import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParcelPaymentChoice } from "@/components/forms/ParcelPaymentChoice";
const base = { total: "205.85", value: "DIGITAL_ONLY" as const, onChange: () => {} };
describe("parcel payment choice UX", () => {
  it("presents two clearly distinguished payment options when full cash is authorized", () => {
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, { ...base, cod: {eligible:true,amountDueAtDelivery:"205.85"} }));
    expect(html).toContain("Online payment");
    expect(html).toContain("Cash on delivery");
    expect(html).toContain("R0 upfront");
    expect(html).toContain("205.85");
    expect(html).toContain('value="FULL_COD"');
    expect(html).not.toContain('value="FULL_COD" disabled');
  });
  it("explains COD approval or eligibility without offering an unsafe selection", () => {
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, { ...base, cod: {eligible:false,amountDueAtDelivery:"205.85",reasonCode:"APPROVAL_PENDING",message:"Awaiting operational approval."} }));
    expect(html).toContain("Cash on delivery");
    expect(html).toContain("Awaiting operational approval.");
    expect(html).toMatch(/<input[^>]*disabled[^>]*value="FULL_COD"/);
  });
  it("muted disabled cash pricing cannot masquerade as a selectable active payment card", () => {
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, { ...base, cod: {eligible:false,amountDueAtDelivery:"205.85",message:"Awaiting independent policy approval."} }));
    expect(html).toMatch(/class="block text-base font-semibold text-\[var\(--kt-public-text-muted-on-surface\)\]">Cash on delivery/);
    expect(html).toMatch(/class="text-xl font-semibold tracking-tight text-\[var\(--kt-public-text-muted-on-surface\)\]">R 205\.85/);
    const enabled = renderToStaticMarkup(createElement(ParcelPaymentChoice, { ...base, cod: {eligible:true,amountDueAtDelivery:"205.85"} }));
    expect(enabled).toMatch(/class="block text-base font-semibold text-\[var\(--kt-brand-navy\)\]">Cash on delivery/);
  });
  it("never treats cash as available while the authoritative method lookup is loading", () => {
    const html = renderToStaticMarkup(createElement(ParcelPaymentChoice, { ...base, loading: true }));
    expect(html).toContain("Checking cash availability");
    expect(html).toMatch(/<input[^>]*disabled[^>]*value="FULL_COD"/);
  });
});
