"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/components/public-v2/motion/gsap-public";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";

export function HomepageMotionController() {
  const { prefersReducedMotion } = usePublicMotionPreference();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion) return;

    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    const ctx = gsap.context(() => {
      // =========================================================================
      // 1. HERO PINNED CHAPTER: States 02 -> 03 -> 04 -> 05 (Trailer Takeover)
      // Duration target: 150vh (within 130-180vh approved contract specification)
      // =========================================================================
      const heroScene = document.querySelector<HTMLElement>('[data-scene="hero"]');
      const truckActor = document.querySelector<HTMLElement>('[data-actor="hero-truck-actor"]');
      const typePlane = document.querySelector<HTMLElement>('[data-actor="hero-type-plane"]');
      const baseline = document.querySelector<HTMLElement>('[data-actor="hero-baseline"]');
      const ctaShop = document.querySelector<HTMLElement>('[data-actor="hero-cta-shop"]');
      const ctaSend = document.querySelector<HTMLElement>('[data-actor="hero-cta-send"]');
      const crawlerScene = document.querySelector<HTMLElement>('[data-scene="crawler"]');
      const trailerTakeover = document.querySelector<HTMLElement>('[data-actor="trailer-takeover"]');
      const marketplaceStage = document.querySelector<HTMLElement>('[data-actor="marketplace-stage"]');

      if (heroScene && truckActor && typePlane) {
        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: heroScene,
            start: "top top",
            end: "+=150%",
            pin: true,
            pinSpacing: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        // STATE 04: Environment moves first (Truck initially holds, typography counter-moves)
        heroTl
          .to(typePlane, { xPercent: -12, opacity: 0.7, ease: "none" }, 0)
          .to(baseline, { xPercent: -20, ease: "none" }, 0)
          .to(ctaShop, { yPercent: 15, opacity: 0.4, ease: "none" }, 0.1)
          .to(ctaSend, { yPercent: 15, opacity: 0.4, ease: "none" }, 0.1);

        // STATE 03 & 04: Truck translates laterally across hero typography
        heroTl.to(
          truckActor,
          {
            xPercent: 35,
            scale: 1.08,
            ease: "power1.inOut",
          },
          0.15
        );

        // STATE 05: Trailer Takeover (Trailer grows to occupy viewport)
        if (trailerTakeover) {
          heroTl.fromTo(
            trailerTakeover,
            { scale: 0.85, opacity: 0, yPercent: 40 },
            { scale: 1.0, opacity: 1, yPercent: 0, ease: "power2.out" },
            0.6
          );
        }
      }

      // =========================================================================
      // 2. MARKETPLACE STAGE: States 06 & 07 (Trailer Resolves Into 5 Categories)
      // =========================================================================
      if (crawlerScene && marketplaceStage) {
        const marketTl = gsap.timeline({
          scrollTrigger: {
            trigger: crawlerScene,
            start: "top 60%",
            end: "center center",
            scrub: 0.5,
          },
        });

        marketTl.fromTo(
          marketplaceStage,
          { yPercent: 12, opacity: 0.7, scale: 0.98 },
          { yPercent: 0, opacity: 1, scale: 1, ease: "power2.out" },
          0
        );
      }

      // =========================================================================
      // 3. PREPARATION SCENE: State 08 (Choice Becomes Parcel)
      // =========================================================================
      const prepScene = document.querySelector<HTMLElement>('[data-scene="preparation"]');
      const merchantWorld = document.querySelector<HTMLElement>('[data-actor="merchant-world"]');
      const packageActor = document.querySelector<HTMLElement>('[data-actor="package-actor"]');
      const prepCopy = document.querySelector<HTMLElement>('[data-actor="prep-copy"]');

      if (prepScene && merchantWorld) {
        const prepTl = gsap.timeline({
          scrollTrigger: {
            trigger: prepScene,
            start: "top 75%",
            end: "bottom center",
            scrub: 0.6,
          },
        });

        prepTl.fromTo(
          merchantWorld,
          { scale: 0.94, yPercent: 8 },
          { scale: 1.04, yPercent: -4, ease: "power1.out" },
          0
        );

        if (packageActor) {
          prepTl.fromTo(
            packageActor,
            { yPercent: 28, scale: 0.88, opacity: 0.7 },
            { yPercent: -12, scale: 1.02, opacity: 1, ease: "power2.out" },
            0.1
          );
        }

        if (prepCopy) {
          prepTl.fromTo(
            prepCopy,
            { yPercent: 10, opacity: 0.6 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0.05
          );
        }
      }

      // =========================================================================
      // 4. LOCAL COLLECTION: State 09 (Mandatory White-Van Moment)
      // =========================================================================
      const collectionScene = document.querySelector<HTMLElement>('[data-scene="collection"]');
      const collectionVan = document.querySelector<HTMLElement>('[data-actor="collection-van"]');
      const collectionCourier = document.querySelector<HTMLElement>('[data-actor="collection-courier"]');

      if (collectionScene && collectionVan) {
        const collectionTl = gsap.timeline({
          scrollTrigger: {
            trigger: collectionScene,
            start: "top 75%",
            end: "center center",
            scrub: 0.5,
          },
        });

        // White van enters from left with baseline weight
        collectionTl.fromTo(
          collectionVan,
          { xPercent: -18, scale: 0.95, opacity: 0.7 },
          { xPercent: 0, scale: 1, opacity: 1, ease: "power2.out" },
          0
        );

        // Courier approaches vehicle
        if (collectionCourier) {
          collectionTl.fromTo(
            collectionCourier,
            { xPercent: 16, opacity: 0.6 },
            { xPercent: 0, opacity: 1, ease: "power2.out" },
            0.15
          );
        }
      }

      // =========================================================================
      // 5. CUSTODY HANDOFF: State 10 (Split Vignette & Chain of Custody)
      // =========================================================================
      const handoffScene = document.querySelector<HTMLElement>('[data-scene="handoff"]');
      const handoffFrame = document.querySelector<HTMLElement>('[data-actor="handoff-frame"]');
      const handoffCopy = document.querySelector<HTMLElement>('[data-actor="handoff-copy"]');

      if (handoffScene && handoffFrame) {
        const handoffTl = gsap.timeline({
          scrollTrigger: {
            trigger: handoffScene,
            start: "top 70%",
            end: "center center",
            scrub: 0.5,
          },
        });

        handoffTl.fromTo(
          handoffFrame,
          { scale: 0.96, opacity: 0.8 },
          { scale: 1, opacity: 1, ease: "power2.out" },
          0
        );

        if (handoffCopy) {
          handoffTl.fromTo(
            handoffCopy,
            { yPercent: 12, opacity: 0.6 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0.1
          );
        }
      }

      // =========================================================================
      // 6. ROUTE / TRACKING: State 11 (Top-Down Vehicle + SVG Route Draw)
      // =========================================================================
      const routeScene = document.querySelector<HTMLElement>('[data-scene="route"]');
      const routeRoad = document.querySelector<HTMLElement>('[data-actor="route-road"]');
      const routeTopTruck = document.querySelector<HTMLElement>('[data-actor="route-top-truck"]');
      const routeSvg = document.querySelector<SVGPathElement>('[data-actor="route-svg-line"] path');

      if (routeScene && routeRoad) {
        const routeTl = gsap.timeline({
          scrollTrigger: {
            trigger: routeScene,
            start: "top 75%",
            end: "bottom top",
            scrub: 0.55,
          },
        });

        // Road parallax
        routeTl.to(routeRoad, { yPercent: -14, scale: 1.06, ease: "none" }, 0);

        // Top-down truck traversal along route
        if (routeTopTruck) {
          routeTl.fromTo(
            routeTopTruck,
            { yPercent: 25, xPercent: -15, scale: 0.92 },
            { yPercent: -20, xPercent: 20, scale: 1.05, ease: "none" },
            0
          );
        }

        // SVG route line dashoffset animation
        if (routeSvg) {
          const pathLength = routeSvg.getTotalLength ? routeSvg.getTotalLength() : 1000;
          gsap.set(routeSvg, { strokeDasharray: pathLength, strokeDashoffset: pathLength });
          routeTl.to(routeSvg, { strokeDashoffset: 0, ease: "none" }, 0);
        }
      }

      // =========================================================================
      // 7. NETWORK SCALE: State 12 (White Flagship Return & Red Truck Escalation)
      // =========================================================================
      const networkScene = document.querySelector<HTMLElement>('[data-scene="network"]');
      const networkTiles = document.querySelectorAll<HTMLElement>('[data-actor="network-tile"]');

      if (networkScene && networkTiles.length > 0) {
        const networkTl = gsap.timeline({
          scrollTrigger: {
            trigger: networkScene,
            start: "top 75%",
            end: "center center",
            scrub: 0.5,
          },
        });

        networkTiles.forEach((tile, idx) => {
          networkTl.fromTo(
            tile,
            { yPercent: 16 * (idx === 0 ? 1 : 1.5), opacity: 0.7 },
            { yPercent: 0, opacity: 1, ease: "power2.out" },
            0.1 * idx
          );
        });
      }

      // =========================================================================
      // 8. ARRIVAL SCENE: State 13 (Quiet Human Delivery Resolution)
      // =========================================================================
      const arrivalScene = document.querySelector<HTMLElement>('[data-scene="arrival"]');
      const arrivalMedia = document.querySelector<HTMLElement>('[data-actor="arrival-media"]');
      const arrivalCopy = document.querySelector<HTMLElement>('[data-actor="arrival-copy"]');

      if (arrivalScene && arrivalMedia) {
        const arrivalTl = gsap.timeline({
          scrollTrigger: {
            trigger: arrivalScene,
            start: "top 75%",
            end: "bottom center",
            scrub: 0.45,
          },
        });

        arrivalTl
          .fromTo(
            arrivalMedia,
            { scale: 0.95, yPercent: 10 },
            { scale: 1, yPercent: 0, ease: "power1.out" },
            0
          )
          .fromTo(
            arrivalCopy,
            { yPercent: 12, opacity: 0.6 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0.1
          );
      }

      // =========================================================================
      // 9. FINALE VIEWPORT: State 14 (Designed Viewport Reveal)
      // =========================================================================
      const finaleScene = document.querySelector<HTMLElement>('[data-scene="finale"]');
      const finaleCard = document.querySelector<HTMLElement>('[data-actor="finale-card"]');

      if (finaleScene && finaleCard) {
        gsap.fromTo(
          finaleCard,
          { yPercent: 12, opacity: 0.8 },
          {
            yPercent: 0,
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: finaleScene,
              start: "top 85%",
              end: "center center",
              scrub: 0.4,
            },
          }
        );
      }
    }, rootRef);

    return () => {
      ctx.revert();
    };
  }, [prefersReducedMotion]);

  return <div ref={rootRef} style={{ display: "contents" }} />;
}
