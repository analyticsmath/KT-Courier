import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HOME_MOBILE_POLICY } from "@/components/public-v3/home/director/home-chapters";
import { commitSelection, resolvePersistedProductId } from "@/components/public-v3/home/director/home-selection";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("post-Hero correction contract", () => {
  it("uses distinct source and target attributes for the product carry", () => {
    expect(source("components/public-v3/home/scenes/CommerceWorldScene.tsx")).toContain("data-commerce-selected-product-media");
    expect(source("components/public-v3/home/scenes/ParcelizationScene.tsx")).toContain("data-parcel-selected-product-media");
    expect(source("components/public-v3/home/actors/PersistentProductCarryLayer.tsx")).toContain("data-product-carry-layer");
  });

  it("keeps the declared mobile ownership policies and consumes chapter budget variables", () => {
    expect(HOME_MOBILE_POLICY).toEqual({ hero: "document", commerce: "native-snap", parcelization: "document", network: "sticky", freight: "sticky", "last-mile": "sticky", finale: "sticky" });
    const css = source("components/public-v3/home/post-hero-rebuild.module.css");
    expect(css).toContain("min-height: var(--kt-home-mobile-budget)");
    expect(css).toContain('[data-kt-scene="network"] [data-home-sticky-stage]');
    expect(css).toContain('[data-kt-scene="parcelization"] [data-home-sticky-stage]');
  });

  it("keeps fan plane sizing stable and uses GSAP-native centering", () => {
    const css = source("components/public-v3/home/post-hero-rebuild.module.css");
    const director = source("components/public-v3/home/director/useHomeNarrativeDirector.ts");
    expect(css).toContain("width: min(32vw, 31rem)");
    expect(css).not.toContain('.product[data-active="true"] { width:');
    expect(director).toContain("xPercent: -50, yPercent: -50");
  });

  it("commits semantic selections only when ids actually change", () => {
    const emit = vi.fn();
    let selected = commitSelection("a", "a", emit);
    selected = commitSelection(selected, "b", emit);
    selected = commitSelection(selected, "b", emit);
    expect(selected).toBe("b");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("b");
  });

  it("never replaces an in-memory product with a storage fallback", () => {
    expect(resolvePersistedProductId("chosen", null, ["first", "chosen", "last"])).toBe("chosen");
    expect(resolvePersistedProductId(undefined, null, ["first", "last"])).toBe("first");
    expect(resolvePersistedProductId(undefined, "last", ["first", "last"])).toBe("last");
  });

  it("contains no labelled route seam UI", () => {
    expect(source("components/public-v3/home/scenes/NetworkRouteScene.tsx")).not.toContain("ROUTE SEAM");
  });
});
