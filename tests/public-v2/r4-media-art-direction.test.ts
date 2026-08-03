import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { homepageMedia, type HomepageMediaAsset } from "@/lib/public-assets/homepage-media";

const workspaceRoot = process.cwd();
const publicRoot = path.join(workspaceRoot, "public");

function isAsset(value: unknown): value is HomepageMediaAsset {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "src" in value &&
      "width" in value &&
      "height" in value
  );
}

function collectAssets(value: unknown): HomepageMediaAsset[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectAssets);
  }

  if (isAsset(value)) {
    return [value];
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectAssets);
  }

  return [];
}

const assets = collectAssets(homepageMedia);
const sourceFiles = [
  "components/public-v2/home/HeroScene.tsx",
  "components/public-v2/home/DocumentaryRail.tsx",
  "components/public-v2/home/ServiceSpectrum.tsx",
  "components/public-v2/home/MarketplacePreview.tsx",
  "components/public-v2/home/NetworkScene.tsx",
  "components/public-v2/home/CoverageScene.tsx",
  "components/public-v2/home/OperationalControlScene.tsx",
  "components/public-v2/home/ClosingScene.tsx",
  "components/public-v2/home/homepage-v2.module.css",
  "components/public-v2/graphics/RouteLine.tsx",
].map((file) => readFileSync(path.join(workspaceRoot, file), "utf8"));
const heroCommandSource = readFileSync(path.join(workspaceRoot, "components/public-v2/home/HeroCommandDock.tsx"), "utf8");
const routeSystemSource = `${sourceFiles[9]}\n${readFileSync(path.join(workspaceRoot, "components/public-v2/graphics/RouteSegment.tsx"), "utf8")}`;

describe("R4 homepage media art direction", () => {
  it("keeps every registry asset local, provisional, dimensioned, and documented", () => {
    expect(assets).toHaveLength(21);

    for (const asset of assets) {
      expect(asset.status).toMatch(/^PROVISIONAL_R[24]$/);
      expect(asset.src).toMatch(/^\/images\/kt-couriers\/provisional\//);
      expect(asset.src).not.toMatch(/^https?:\/\//);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(asset.format).toBe("webp");
      expect(asset.sourceLedgerReference).toMatch(/^#/);
      expect(existsSync(path.join(publicRoot, asset.src))).toBe(true);
    }
  });

  it("keeps meaningful image alternatives useful and decorative environment media empty", () => {
    for (const asset of assets) {
      if (asset.decorative) {
        expect(asset.alt).toBe("");
      } else {
        expect(asset.alt.trim()).not.toBe("");
      }
    }
  });

  it("records responsive R4 variants without duplicate eager media", () => {
    const variants = assets.flatMap((asset) => [asset.desktop, asset.tablet, asset.mobile].filter(Boolean));
    expect(variants).toHaveLength(8);

    for (const variant of variants) {
      expect(variant!.src).toMatch(/^\/images\/kt-couriers\/provisional\//);
      expect(variant!.width).toBeGreaterThan(0);
      expect(variant!.height).toBeGreaterThan(0);
      expect(existsSync(path.join(publicRoot, variant!.src))).toBe(true);
    }

    expect(assets.filter((asset) => asset.priority)).toEqual([
      expect.objectContaining({ id: "R4-HERO-TRUCK-FRAME" }),
    ]);
  });

  it("keeps the hero's R5 contract static and complete", () => {
    const heroSource = `${sourceFiles[0]}\n${heroCommandSource}`;

    for (const selector of [
      'data-kt-motion-scene="hero"',
      'data-kt-motion-anchor="hero-start"',
      'data-kt-motion-anchor="hero-exit"',
      'motionLayer="truck"',
      'data-kt-motion-layer="truck-shadow"',
      'data-kt-motion-layer="environment"',
      'data-kt-motion-layer="copy"',
      'data-kt-motion-layer="command"',
    ]) {
      expect(heroSource).toContain(selector);
    }

    const css = sourceFiles[8];
    for (const variable of [
      "--kt-truck-x",
      "--kt-truck-y",
      "--kt-truck-scale",
      "--kt-truck-rotate",
      "--kt-shadow-x",
      "--kt-shadow-y",
      "--kt-shadow-scale",
      "--kt-environment-y",
      "--kt-environment-scale",
      "--kt-route-progress",
      "--kt-copy-opacity",
    ]) {
      expect(css).toContain(variable);
    }
  });

  it("does not introduce motion tooling, remote media, gradients, or marketplace imitation", () => {
    const publicR4Source = sourceFiles.join("\n");

    expect(publicR4Source).not.toMatch(/\bgsap\b|scrolltrigger|scroll-linked|parallax|autoplay/i);
    expect(publicR4Source).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/i);
    expect(publicR4Source).not.toMatch(/add to cart|stock count|\brating\b|\bprice\b/i);
    expect(publicR4Source).not.toMatch(/https?:\/\//);
  });

  it("uses only decorative route geometry rather than a geographic or live-tracking claim", () => {
    const routeSource = routeSystemSource;
    expect(routeSource).toContain('aria-hidden="true"');
    expect(routeSource).toContain('pathLength="1"');
    expect(routeSource).not.toMatch(/province|latitude|longitude|tracking|live/i);
  });
});
