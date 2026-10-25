import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketplaceTrustedPackageManager } from "@/components/admin/MarketplaceTrustedPackageManager";
import { parseMeasuredConsignmentDraft } from "@/components/admin/MeasuredConsignmentDraft";

describe("trusted multi-item packaging administration", () => {
  it("provides labelled measured-consignment fields to authorized package authors", () => {
    const html = renderToStaticMarkup(createElement(MarketplaceTrustedPackageManager,
      { initial: [], actorId: "disposable-admin", canManage: true }));
    expect(html).toContain("Measured multi-item consignment");
    for (const id of ["bundle-store", "bundle-line-0-offerReference", "bundle-line-0-variantReference",
      "bundle-line-0-publicationVersion", "bundle-line-0-quantity", "bundle-line-0-modifiers",
      "bundle-lengthCm", "bundle-widthCm", "bundle-heightCm", "bundle-weightKg",
      "bundle-authority", "bundle-reason", "bundle-from"]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("different authorized administrator must approve");
  });
  it("validates exact sealed contents before submitting, with actionable duplicate guidance", () => {
    const one = { offerReference: "offer", variantReference: "variant", publicationVersion: "5", quantity: 2, modifiers: [] };
    const bundle = { storeId: "store", packingRule: "MEASURED_SEALED_CONSIGNMENT", lines: [one],
      lengthCm: 30, widthCm: 20, heightCm: 10, weightKg: 6, authorityReference: "reference:actual-measurements" };
    expect(parseMeasuredConsignmentDraft(bundle)).toEqual(bundle);
    expect(() => parseMeasuredConsignmentDraft({ ...bundle, lines: [one, one] })).toThrow(/duplicate product selections/i);
    expect(() => parseMeasuredConsignmentDraft({ ...bundle, weightKg: 0 })).toThrow(/too small|positive|greater than/i);
    expect(() => parseMeasuredConsignmentDraft({ ...bundle, lines: [{...one, quantity: 1}] })).toThrow(/multiple units|consignment/i);
  });
  it("does not render measurement-authoring actions for read-only administrators", () => {
    const html = renderToStaticMarkup(createElement(MarketplaceTrustedPackageManager,
      { initial: [], actorId: "readonly-admin", canManage: false }));
    expect(html).not.toContain("Save measured consignment draft");
    expect(html).not.toContain("Add product line");
  });
});
