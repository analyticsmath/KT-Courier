import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicHomeExperience } from "@/components/public-v3/home/PublicHomeExperience";

const markup = renderToStaticMarkup(createElement(PublicHomeExperience));
const opening = markup.slice(
  markup.indexOf('<section class="'),
  markup.indexOf("</section>"),
);

describe("replacement homepage initial content", () => {
  it("makes sending and local shopping available before any motion runs", () => {
    expect(opening).toContain("Good things.");
    expect(opening).toContain('href="/services/parcel"');
    expect(opening).toContain('href="/shop"');
  });
  it("connects the hero seal and every in-page link to an existing destination", () => {
    const fragments = [...markup.matchAll(/href="#([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(fragments).toContain("little-connections");
    for (const fragment of fragments)
      expect(markup).toContain(`id="${fragment}"`);
    expect(opening).toContain(
      "Discover the little connections behind every delivery",
    );
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
      'alt="A florist at the door of her neighbourhood flower shop"',
    );
    expect(markup).not.toContain('data-kt-motion-owned="director"');
    expect(markup).not.toContain("data-actor-slot");
  });
  it("provides meaningful chapters and preparation guidance without a product feed", () => {
    expect(markup).not.toContain('href="/shop/products/');
    expect(markup).not.toContain("kt-real-products");
    expect(markup).toContain('href="/shop"');
    for (const chapter of [
      "delivery",
      "business",
      "coverage",
      "packing",
      "keep-connected",
    ]) {
      expect(markup).toContain(`data-home-chapter="${chapter}"`);
    }
    expect(markup).toContain("Choose a sturdy box");
    expect(markup).toContain('href="/coverage-areas"');
  });
});
