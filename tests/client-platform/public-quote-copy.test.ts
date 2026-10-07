import { describe, expect, it } from "vitest";
import { publicServicePages, serviceFaqs } from "@/lib/public-services/service-page-registry";
import { publicFaqSections } from "@/lib/public-faq/faqs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingServiceView } from "@/components/public-v3/services/authored/PricingServiceView";

describe("anonymous quote public authority", () => {
  it("keeps FAQ, pricing, and metadata consistent with anonymous quotation", () => {
    const copy = JSON.stringify({ publicServicePages, serviceFaqs, publicFaqSections });
    expect(copy).not.toMatch(/authenticated (?:quote|request (?:flow|workflow)|delivery request)|account-based quote|account (?:is )?required (?:before|for) (?:a )?quote/i);
    const pricing = publicServicePages.find((page) => page.id === "pricing")!;
    expect(pricing.summary).toContain("without an account");
    expect(pricing.metadataDescription).toContain("without an account");
    expect(pricing.primaryAction.href).toBe("/quote");
    expect(serviceFaqs.pricing.answer).toContain("without an account");
    expect(serviceFaqs.coverage.answer).toContain("both pickup and dropoff");
  });
  it("uses the same anonymous quote authority in the authored pricing presentation", () => {
    const pricing = publicServicePages.find((page) => page.id === "pricing")!;
    const html = renderToStaticMarkup(createElement(PricingServiceView, { service: pricing }));
    expect(html).toContain("without an account");
    expect(html).toContain('href="/quote"');
    expect(html).not.toMatch(/authenticated delivery request|scheduled dispatch/i);
  });
});
