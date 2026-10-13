import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PersistentHomeCinematicLayer } from "@/components/public-v3/home/actors/PersistentHomeCinematicLayer";
import { CommerceWorldScene } from "@/components/public-v3/home/scenes/HomeCinematicScenes";

describe("cinematic homepage initial network budget", () => {
  it("does not eagerly request deep-scroll vehicle and handoff plates during the hero", () => {
    const html = renderToStaticMarkup(createElement(PersistentHomeCinematicLayer));
    const plates = Array.from(html.matchAll(/<img[^>]*data-(?:box-plate|vehicle-plate|handoff-plate)[^>]*>/g), (match) => match[0]);
    expect(plates).toHaveLength(4);
    for (const plate of plates) {
      expect(plate).not.toMatch(/\ssrc=/);
      expect(plate).toContain('loading="lazy"');
      expect(plate).toContain('decoding="async"');
    }
    for (const name of ["handoff_01_approach.webp", "pickup_A00_van_closed_right.webp", "delivery_B00_van_closed_left.webp"]) {
      expect(html).not.toContain(name);
    }
  });

  it("requests below-the-fold marketplace media lazily", () => {
    const html = renderToStaticMarkup(createElement(CommerceWorldScene, {
      categories: [],
      products: [{
        id: "product-1",
        productReference: "product-1",
        productSlug: "sample",
        title: "Sample",
        image: "/media/test.webp",
        imageAlt: "Sample image",
        href: "/shop/sample",
        brandName: "Local",
        priceAmount: "12.00",
        currency: "ZAR",
        priceFrom: false,
        variantCount: 1,
        storeCount: 1,
      }],
      selectedProductId: "product-1",
    }));
    expect(html).toMatch(/<img[^>]*loading="lazy"[^>]*decoding="async"[^>]*src="\/media\/test.webp"/);
  });
});
