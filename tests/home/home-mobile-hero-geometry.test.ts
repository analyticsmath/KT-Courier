import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicHomeExperience } from "@/components/public-v3/home/PublicHomeExperience";

const markup = renderToStaticMarkup(createElement(PublicHomeExperience));
const opening = markup.slice(
  markup.indexOf('<section class="kt-opening '),
  markup.indexOf("</section>"),
);

describe("replacement homepage initial content", () => {
  it("makes sending and local shopping available before any motion runs", () => {
    expect(opening).toContain("From your hands.");
    expect(opening).toContain('href="/services/parcel"');
    expect(opening).toContain('href="/shop"');
  });
  it("keeps the van out of the opening while providing its later scene", () => {
    expect(opening).not.toContain("protagonist-van");
    expect(markup.indexOf("protagonist-van")).toBeGreaterThan(
      markup.indexOf("</section>"),
    );
    expect(markup).not.toContain("data-hero-opening-poster");
  });
  it("renders meaningful static content and a canonical quote path without the retired director", () => {
    expect(markup).toContain('href="/quote"');
    expect(markup).toContain(
      'alt="A small-business owner preparing products for delivery"',
    );
    expect(markup).not.toContain('data-kt-motion-owned="director"');
    expect(markup).not.toContain("data-actor-slot");
  });
  it("keeps product listings off the homepage", () => {
    expect(markup).not.toContain('href="/shop/products/');
    expect(markup).not.toContain("kt-real-products");
    expect(markup).toContain('href="/shop"');
  });
});
