import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicHomeExperience } from "@/components/public-v3/home/PublicHomeExperience";
import type { HomepageStorefrontPresentation } from "@/components/public-v3/home/data/home-storefront-presentation";

const markup = renderToStaticMarkup(createElement(PublicHomeExperience));
const opening = markup.slice(markup.indexOf('<section class="kt-opening"'), markup.indexOf('</section>'));

describe("replacement homepage initial content", () => {
  it("makes sending and local shopping available before any motion runs", () => {
    expect(opening).toContain('From your hands.');
    expect(opening).toContain('href="/services/parcel"');
    expect(opening).toContain('href="/shop"');
  });
  it("keeps the van out of the opening while providing its later scene", () => {
    expect(opening).not.toContain('protagonist-van');
    expect(markup.indexOf('protagonist-van')).toBeGreaterThan(markup.indexOf('</section>'));
    expect(markup).not.toContain('data-hero-opening-poster');
  });
  it("renders meaningful static content and a canonical quote path without the retired director", () => {
    expect(markup).toContain('href="/quote"');
    expect(markup).toContain('alt="A small-business owner preparing products for delivery"');
    expect(markup).not.toContain('data-kt-motion-owned="director"');
    expect(markup).not.toContain('data-actor-slot');
  });
  it("does not expose catalog product links unless storefront exposure is enabled", () => {
    const presentation: HomepageStorefrontPresentation = { categories: [], stores: [], products: [{ id: 'published', productReference: 'reference', productSlug: 'real-product', title: 'Published item', image: '/media/public/home/kt-home-01-world-market.webp', imageAlt: 'Published product', priceAmount: '100.00', currency: 'ZAR', priceFrom: false, variantCount: 1, storeCount: 1, href: '/shop/products/real-product' }] };
    const hidden = renderToStaticMarkup(createElement(PublicHomeExperience, { storefrontPresentation: presentation, isStorefrontExposed: false }));
    const exposed = renderToStaticMarkup(createElement(PublicHomeExperience, { storefrontPresentation: presentation, isStorefrontExposed: true }));
    expect(hidden).not.toContain('href="/shop/products/real-product"');
    expect(exposed).toContain('href="/shop/products/real-product"');
  });
});
