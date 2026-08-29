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
      // 1. HERO → CRAWLER: Environment Parallax + Foreground Actor Travel
      // =========================================================================
      const heroScene = document.querySelector('[data-scene="hero"]');
      const heroEnv = document.querySelector('[data-actor="hero-env"]');
      const heroPlane = document.querySelector('[data-actor="hero-plane"]');
      const heroCutout = document.querySelector('[data-actor="hero-cutout"]');
      const heroNeighbor = document.querySelector('[data-actor="hero-neighbor"]');
      const crawlerFirstImage = document.querySelector('[data-actor="crawler-first-item"]');

      if (heroScene && heroEnv && heroPlane) {
        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: heroScene,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });

        // Environment parallax (slow world: -4% to +4%)
        heroTl.to(heroEnv, { scale: 1.06, yPercent: 4, ease: "none" }, 0);

        // Editorial plane withdraws
        heroTl.to(heroPlane, { yPercent: -28, opacity: 0.4, ease: "none" }, 0);

        // Foreground actor parallax (fashion cutout travels across hero/crawler boundary: +16%)
        if (heroCutout) {
          heroTl.to(
            heroCutout,
            { xPercent: 18, yPercent: -35, scale: 0.92, ease: "none" },
            0
          );
        }

        // Secondary neighbor media recedes
        if (heroNeighbor) {
          heroTl.to(heroNeighbor, { yPercent: -45, opacity: 0, ease: "none" }, 0);
        }

        // Overlapping boundary: first crawler image enters before hero is fully gone
        if (crawlerFirstImage) {
          heroTl.fromTo(
            crawlerFirstImage,
            { scale: 0.9, yPercent: 20 },
            { scale: 1, yPercent: 0, ease: "none" },
            0.6
          );
        }
      }

      // =========================================================================
      // 2. CRAWLER → PREPARE: Horizontal-to-Vertical & Selected Object Reframing
      // =========================================================================
      const crawlerScene = document.querySelector('[data-scene="crawler"]');
      const crawlerTrack = document.querySelector('[data-actor="crawler-track"]');
      const crawlerActiveItem = document.querySelector('[data-actor="crawler-active-item"]');

      if (crawlerScene && crawlerTrack) {
        const crawlerTl = gsap.timeline({
          scrollTrigger: {
            trigger: crawlerScene,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5,
          },
        });

        // Horizontal media progression
        crawlerTl.to(crawlerTrack, { xPercent: -55, ease: "none" }, 0);

        // Inner-image crop parallax on active category image
        if (crawlerActiveItem) {
          const innerImg = crawlerActiveItem.querySelector("img");
          if (innerImg) {
            crawlerTl.to(innerImg, { scale: 1.08, xPercent: 5, ease: "none" }, 0);
          }
        }
      }

      // =========================================================================
      // 3. PREPARATION: Merchant World Expansion & Package Foreground Actor
      // =========================================================================
      const prepScene = document.querySelector('[data-scene="preparation"]');
      const merchantWorld = document.querySelector('[data-actor="merchant-world"]');
      const packageActor = document.querySelector('[data-actor="package-actor"]');
      const prepCopy = document.querySelector('[data-actor="prep-copy"]');

      if (prepScene && merchantWorld) {
        const prepTl = gsap.timeline({
          scrollTrigger: {
            trigger: prepScene,
            start: "top 75%",
            end: "bottom center",
            scrub: 0.6,
          },
        });

        // Counter-parallax: Background merchant world expands slowly
        prepTl.fromTo(
          merchantWorld,
          { scale: 0.92, yPercent: 8 },
          { scale: 1.05, yPercent: -4, ease: "power1.out" },
          0
        );

        // Foreground actor parallax: Package actor detaches and moves independently (+18%)
        if (packageActor) {
          prepTl.fromTo(
            packageActor,
            { yPercent: 35, scale: 0.85, opacity: 0.7 },
            { yPercent: -20, scale: 1.02, opacity: 1, ease: "power2.out" },
            0.08
          );
        }

        // Text differential: Copy holds briefly before sliding
        if (prepCopy) {
          prepTl.fromTo(
            prepCopy,
            { yPercent: 12, opacity: 0.6 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0.04
          );
        }
      }

      // =========================================================================
      // 4. PREPARE → HANDOFF: Edge-Slice Parallax & Viewport Ownership Takeover
      // =========================================================================
      const handoffScene = document.querySelector('[data-scene="handoff"]');
      const slices = document.querySelectorAll('[data-slice-index]');
      const handoffCopy = document.querySelector('[data-actor="handoff-copy"]');
      const handoffContainer = document.querySelector('[data-actor="handoff-container"]');

      if (handoffScene && slices.length > 0) {
        const handoffTl = gsap.timeline({
          scrollTrigger: {
            trigger: handoffScene,
            start: "top 65%",
            end: "center center",
            scrub: 0.5,
          },
        });

        // Edge-slice parallax: Vertical slices move at differential rates and converge
        slices.forEach((slice, idx) => {
          const isEven = idx % 2 === 0;
          handoffTl.fromTo(
            slice,
            {
              yPercent: isEven ? 18 : -18,
              scaleY: 0.92,
              opacity: 0.6,
            },
            {
              yPercent: 0,
              scaleY: 1,
              opacity: 1,
              ease: "power2.out",
            },
            idx * 0.06
          );
        });

        // Handoff copy enters cleanly
        if (handoffCopy) {
          handoffTl.fromTo(
            handoffCopy,
            { yPercent: 16, opacity: 0.5 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0.12
          );
        }

        // Handoff container holds viewport ownership
        if (handoffContainer) {
          handoffTl.to(handoffContainer, { scale: 1.02, ease: "none" }, 0.3);
        }
      }

      // =========================================================================
      // 5. HANDOFF → ROUTE: Map Hold / Road Documentary Differential
      // =========================================================================
      const routeScene = document.querySelector('[data-scene="route"]');
      const routeRoad = document.querySelector('[data-actor="route-road"]');
      const routeMap = document.querySelector('[data-actor="route-map"]');
      const routeCopy = document.querySelector('[data-actor="route-copy"]');

      if (routeScene && routeRoad) {
        const routeTl = gsap.timeline({
          scrollTrigger: {
            trigger: routeScene,
            start: "top 70%",
            end: "bottom top",
            scrub: 0.55,
          },
        });

        // Text/media differential: Map holds while road moves faster
        routeTl
          .to(routeRoad, { yPercent: -15, scale: 1.05, ease: "none" }, 0)
          .fromTo(routeMap, { scale: 0.97, yPercent: 4 }, { scale: 1, yPercent: 0, ease: "none" }, 0);

        if (routeCopy) {
          routeTl.fromTo(
            routeCopy,
            { yPercent: 12, opacity: 0.7 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0.05
          );
        }
      }

      // =========================================================================
      // 6. ROUTE → NETWORK: Spatial Grid Elevation & Commerce Field
      // =========================================================================
      const networkScene = document.querySelector('[data-scene="network"]');
      const networkField = document.querySelector('[data-actor="network-field"]');
      const networkTiles = document.querySelectorAll('[data-actor="network-tile"]');

      if (networkScene && networkField) {
        const networkTl = gsap.timeline({
          scrollTrigger: {
            trigger: networkScene,
            start: "top 80%",
            end: "bottom top",
            scrub: 0.5,
          },
        });

        networkTl.to(networkField, { yPercent: -8, ease: "none" }, 0);

        if (networkTiles.length > 0) {
          networkTiles.forEach((tile, idx) => {
            networkTl.fromTo(
              tile,
              { yPercent: 10 * (idx % 3), opacity: 0.8 },
              { yPercent: 0, opacity: 1, ease: "none" },
              0.05 * idx
            );
          });
        }
      }

      // =========================================================================
      // 7. NETWORK → ARRIVAL: Single Order Resolution
      // =========================================================================
      const arrivalScene = document.querySelector('[data-scene="arrival"]');
      const arrivalMedia = document.querySelector('[data-actor="arrival-media"]');
      const arrivalCopy = document.querySelector('[data-actor="arrival-copy"]');

      if (arrivalScene && arrivalMedia) {
        const arrivalTl = gsap.timeline({
          scrollTrigger: {
            trigger: arrivalScene,
            start: "top 75%",
            end: "bottom center",
            scrub: 0.5,
          },
        });

        arrivalTl
          .fromTo(
            arrivalMedia,
            { scale: 0.94, yPercent: 8 },
            { scale: 1, yPercent: 0, ease: "power1.out" },
            0
          )
          .fromTo(
            arrivalCopy,
            { yPercent: 14, opacity: 0.6 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0.1
          );
      }

      // =========================================================================
      // 8. ARRIVAL → FOOTER: Footer Reveal Parallax
      // =========================================================================
      const finaleScene = document.querySelector('[data-scene="finale"]');
      const finaleCard = document.querySelector('[data-actor="finale-card"]');

      if (finaleScene && finaleCard) {
        gsap.fromTo(
          finaleCard,
          { yPercent: 10, opacity: 0.8 },
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
