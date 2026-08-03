import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDesktopHeroScrollDistance,
  heroMotionConfig,
  homepageMotionSelectors,
  isDesktopHeroMotionEligible,
} from "@/components/public-v2/motion";
import { homepageMedia } from "@/lib/public-assets/homepage-media";

const workspaceRoot = process.cwd();
const readSource = (file: string) => readFileSync(path.join(workspaceRoot, file), "utf8");
const controllerSource = readSource("components/public-v2/motion/HomepageMotionController.tsx");
const heroMotionSource = readSource("components/public-v2/motion/create-hero-motion.ts");
const secondaryMotionSource = readSource("components/public-v2/motion/create-secondary-motion.ts");
const heroSource = readSource("components/public-v2/home/HeroScene.tsx");
const heroCommandSource = readSource("components/public-v2/home/HeroCommandDock.tsx");
const documentarySource = readSource("components/public-v2/home/DocumentaryRail.tsx");
const nativeScrollerSource = readSource("components/public-v2/interactions/NativeScroller.tsx");
const packageJson = JSON.parse(readSource("package.json")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("R5 homepage motion system", () => {
  it("keeps desktop eligibility and scroll distance within the approved bounds", () => {
    expect(getDesktopHeroScrollDistance(320)).toBe(heroMotionConfig.desktop.scrollDistanceMin);
    expect(getDesktopHeroScrollDistance(2000)).toBe(heroMotionConfig.desktop.scrollDistanceMax);
    expect(getDesktopHeroScrollDistance(900)).toBe(864);

    expect(isDesktopHeroMotionEligible({
      width: 1120,
      height: 680,
      prefersReducedMotion: false,
      treatment: "BOUNDED_CAMERA",
    })).toBe(true);
    expect(isDesktopHeroMotionEligible({
      width: 1119,
      height: 900,
      prefersReducedMotion: false,
      treatment: "BOUNDED_CAMERA",
    })).toBe(false);
    expect(isDesktopHeroMotionEligible({
      width: 1440,
      height: 900,
      prefersReducedMotion: true,
      treatment: "BOUNDED_CAMERA",
    })).toBe(false);
    expect(isDesktopHeroMotionEligible({
      width: 1440,
      height: 900,
      prefersReducedMotion: false,
      treatment: "ISOLATED_VEHICLE",
    })).toBe(false);
  });

  it("keeps the current media treatment explicit and bounded", () => {
    expect(homepageMedia.hero.vehicle.motionTreatment).toBe("BOUNDED_CAMERA");
    expect(heroMotionSource).not.toMatch(/ISOLATED_VEHICLE/);
    expect(heroMotionSource).toContain('pin: elements.pinStage');
    expect(heroMotionSource).toContain('pinSpacing: true');
    expect(heroMotionSource).toContain('start: "top top"');
    expect(heroMotionSource).toContain("invalidateOnRefresh: true");
  });

  it("centralizes the stable selector contract while retaining static markup", () => {
    expect(homepageMotionSelectors.root).toBe('[data-kt-homepage="v2"]');
    expect(homepageMotionSelectors.hero.pinStage).toBe('[data-kt-motion-pin="hero-stage"]');
    expect(homepageMotionSelectors.documentary.entry).toBe('[data-kt-motion-anchor="documentary-entry"]');

    for (const selector of [
      'data-kt-motion-scene="hero"',
      'data-kt-motion-pin="hero-stage"',
      'data-kt-motion-anchor="hero-start"',
      'data-kt-motion-anchor="hero-exit"',
      'data-kt-motion-layer="environment"',
      'data-kt-motion-layer="truck-shadow"',
      'motionLayer="truck"',
      'data-kt-motion-layer="copy"',
    ]) {
      expect(heroSource).toContain(selector);
    }

    expect(heroCommandSource).toContain('data-kt-motion-layer="command"');
    expect(documentarySource).toContain('data-kt-motion-anchor="documentary-entry"');
    expect(documentarySource).toContain('data-kt-motion-reveal="heading"');
    expect(documentarySource).toContain('motionReveal="line"');
  });

  it("uses scoped lifecycle cleanup and leaves mobile and reduced-motion branches unpinned", () => {
    expect(controllerSource).toContain('"use client"');
    expect(controllerSource).toContain("gsap.context");
    expect(controllerSource).toContain("gsap.matchMedia");
    expect(controllerSource).toContain("heroMotionMediaQueries");
    expect(controllerSource).toContain("revertMotionLifecycle");
    expect(controllerSource).toContain('root.removeAttribute("data-kt-motion-ready")');
    expect(controllerSource).toContain("createRefreshCoordinator");
    expect(controllerSource).not.toMatch(/useState|setState|killAll/);
    expect(heroMotionSource).toContain('id: "kt-r5-hero-tablet"');
    expect(heroMotionSource.split("export function createTabletHeroMotion")[1]).not.toContain("pin:");
    expect(secondaryMotionSource).toContain("toggleActions: \"play none none none\"");
  });

  it("does not introduce prohibited scroll APIs or modify R3 scroller ownership", () => {
    const r5Source = [controllerSource, heroMotionSource, secondaryMotionSource].join("\n");

    for (const prohibitedApi of [
      "ScrollSmoother",
      "normalizeScroll",
      "scrollerProxy",
      "pinReparent",
      "snap:",
      "addEventListener(\"scroll\"",
    ]) {
      expect(r5Source).not.toContain(prohibitedApi);
    }

    expect(nativeScrollerSource).not.toMatch(/gsap|ScrollTrigger/i);
  });

  it("keeps GSAP inside the client motion boundary and adds no motion dependency", () => {
    const serverSources = [
      readSource("app/(public)/page.tsx"),
      readSource("app/(public)/layout.tsx"),
      readSource("components/public-v2/home/HomepageV2.tsx"),
      heroSource,
    ].join("\n");
    const motionDependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })
      .filter((dependency) => /gsap|motion|lenis|lottie|three/i.test(dependency));

    expect(serverSources).not.toMatch(/from "gsap|from 'gsap/);
    expect(packageJson.dependencies?.gsap).toBe("^3.15.0");
    expect(motionDependencies).toEqual(["gsap"]);
  });
});
