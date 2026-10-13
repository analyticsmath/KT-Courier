import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroVanSequenceActor } from "@/components/public-v3/actors/HeroVanSequenceActor";
import { HERO_VAN_FRAMES } from "@/components/public-v3/home/director/hero-van-sequence.generated";

describe("first-view hero van fetch priority", () => {
  it("keeps one high-priority opening frame; preserves other states for director decoding", () => {
    const html = renderToStaticMarkup(createElement(HeroVanSequenceActor));
    const images = Array.from(html.matchAll(/<img\b[^>]*>/g), (match) => match[0]);
    const sources = Array.from(html.matchAll(/<source\b[^>]*>/g), (match) => match[0]);
    expect(images).toHaveLength(HERO_VAN_FRAMES.length);
    expect(sources).toHaveLength(HERO_VAN_FRAMES.length);

    expect(images[0]).toContain('fetchPriority="high"');
    expect(images[0]).toContain(`src="${HERO_VAN_FRAMES[0].desktopSrc}"`);
    expect(sources[0]).toContain(`srcSet="${HERO_VAN_FRAMES[0].mobileSrc}"`);

    // Neither the far-end hero pose nor adjacent frames compete with the LCP request.
    for (let index = 1; index < images.length; index++) {
      expect(images[index], `frame ${index}`).toContain('fetchPriority="low"');
      expect(images[index], `frame ${index}`).not.toMatch(/\ssrc="/);
      expect(sources[index], `frame ${index}`).not.toContain('srcSet="');
      expect(images[index], `frame ${index}`).toContain(`data-hero-desktop-src="${HERO_VAN_FRAMES[index].desktopSrc}"`);
      expect(sources[index], `frame ${index}`).toContain(`data-hero-mobile-src="${HERO_VAN_FRAMES[index].mobileSrc}"`);
    }
  });
});
