"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createDesktopHeroMotion, createTabletHeroMotion } from "./create-hero-motion";
import { createSecondaryMotion } from "./create-secondary-motion";
import { heroMotionMediaQueries } from "./hero-motion-config";
import { homepageMotionSelectors } from "./motion-selectors";
import type { HeroMotionElements, HomepageMotionControllerProps } from "./motion-types";

function getHeroMotionElements(root: HTMLElement): HeroMotionElements | null {
  const scene = root.querySelector<HTMLElement>(homepageMotionSelectors.hero.scene);
  const pinStage = root.querySelector<HTMLElement>(homepageMotionSelectors.hero.pinStage);
  const environment = root.querySelector<HTMLElement>(homepageMotionSelectors.hero.environment);
  const route = root.querySelector<SVGSVGElement>(homepageMotionSelectors.hero.route);
  const routePath = root.querySelector<SVGPathElement>(homepageMotionSelectors.hero.routePath);
  const truckShadow = root.querySelector<HTMLElement>(homepageMotionSelectors.hero.truckShadow);
  const truck = root.querySelector<HTMLElement>(homepageMotionSelectors.hero.truck);
  const copy = root.querySelector<HTMLElement>(homepageMotionSelectors.hero.copy);
  const command = root.querySelector<HTMLElement>(homepageMotionSelectors.hero.command);
  const handoff = root.querySelector<HTMLElement>(homepageMotionSelectors.hero.handoff);

  if (!scene || !pinStage || !environment || !route || !routePath || !truckShadow || !truck || !copy || !command || !handoff) {
    return null;
  }

  return {
    scene,
    pinStage,
    environment,
    route,
    routePath,
    routeCheckpoints: Array.from(root.querySelectorAll<SVGCircleElement>(homepageMotionSelectors.hero.routeCheckpoints)),
    truckShadow,
    truck,
    copy,
    command,
    handoff,
  };
}

function createRefreshCoordinator(root: HTMLElement) {
  let disposed = false;
  let refreshFrame: number | null = null;
  let removeImageLoadListener: (() => void) | undefined;

  const requestRefresh = () => {
    if (disposed || refreshFrame !== null) return;

    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = null;
      if (!disposed) ScrollTrigger.refresh();
    });
  };

  const heroImage = root.querySelector<HTMLImageElement>('[data-kt-motion-layer="truck"] img');
  if (heroImage) {
    if (heroImage.complete) {
      if (typeof heroImage.decode === "function") {
        void heroImage.decode().catch(() => undefined).then(requestRefresh);
      } else {
        requestRefresh();
      }
    } else {
      const onLoad = () => requestRefresh();
      heroImage.addEventListener("load", onLoad, { once: true });
      removeImageLoadListener = () => heroImage.removeEventListener("load", onLoad);
    }
  }

  if ("fonts" in document) {
    void document.fonts.ready.catch(() => undefined).then(requestRefresh);
  }

  requestRefresh();

  return () => {
    disposed = true;
    removeImageLoadListener?.();
    if (refreshFrame !== null) window.cancelAnimationFrame(refreshFrame);
  };
}

function revertMotionLifecycle(
  media: ReturnType<typeof gsap.matchMedia> | null,
  context: ReturnType<typeof gsap.context> | null,
) {
  media?.revert();
  context?.revert();
}

/** A zero-visual client boundary that owns all R5 GSAP lifecycle work. */
export function HomepageMotionController({ rootId, heroTreatment }: HomepageMotionControllerProps) {
  useLayoutEffect(() => {
    const root = document.getElementById(rootId);
    if (!(root instanceof HTMLElement) || heroTreatment !== "BOUNDED_CAMERA") return;

    const elements = getHeroMotionElements(root);
    if (!elements) return;

    let context: ReturnType<typeof gsap.context> | null = null;
    let media: ReturnType<typeof gsap.matchMedia> | null = null;
    try {
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        media = gsap.matchMedia();
        media.add(heroMotionMediaQueries, (mediaContext) => {
          let cleanupRefreshCoordinator: (() => void) | undefined;
          const conditions = mediaContext.conditions as { desktop?: boolean; tablet?: boolean } | undefined;

          if (conditions?.desktop) {
            createDesktopHeroMotion(elements);
            createSecondaryMotion(root);
            root.dataset.ktMotionReady = "true";
            cleanupRefreshCoordinator = createRefreshCoordinator(root);
          } else if (conditions?.tablet) {
            createTabletHeroMotion(elements);
            createSecondaryMotion(root);
            root.dataset.ktMotionReady = "true";
            cleanupRefreshCoordinator = createRefreshCoordinator(root);
          }

          return () => {
            cleanupRefreshCoordinator?.();
            root.removeAttribute("data-kt-motion-ready");
          };
        });
      }, root);
    } catch {
      revertMotionLifecycle(media, context);
      root.removeAttribute("data-kt-motion-ready");
    }

    return () => {
      revertMotionLifecycle(media, context);
      root.removeAttribute("data-kt-motion-ready");
    };
  }, [heroTreatment, rootId]);

  return <span aria-hidden="true" data-kt-motion-controller hidden />;
}
