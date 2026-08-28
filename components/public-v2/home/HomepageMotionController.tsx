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
      // 1. HERO → CRAWLER Connected Transition
      const heroEnv = document.querySelector('[data-actor="hero-env"]');
      const heroPlane = document.querySelector('[data-actor="hero-plane"]');
      const heroCutout = document.querySelector('[data-actor="hero-cutout"]');
      const heroNeighbor = document.querySelector('[data-actor="hero-neighbor"]');

      if (heroEnv && heroPlane) {
        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: '[data-scene="hero"]',
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        heroTl
          .to(heroPlane, { yPercent: -20, opacity: 0.7, ease: "none" }, 0)
          .to(heroEnv, { scale: 1.08, yPercent: 12, ease: "none" }, 0);

        if (heroCutout) {
          heroTl.to(
            heroCutout,
            { xPercent: 20, yPercent: -30, scale: 0.95, ease: "none" },
            0
          );
        }

        if (heroNeighbor) {
          heroTl.to(heroNeighbor, { yPercent: -40, opacity: 0, ease: "none" }, 0);
        }
      }

      // 2. CRAWLER → PREPARE Selected Object Carry
      const crawlerScene = document.querySelector('[data-scene="crawler"]');
      const crawlerTrack = document.querySelector('[data-actor="crawler-track"]');

      if (crawlerScene && crawlerTrack) {
        gsap.to(crawlerTrack, {
          xPercent: -50,
          ease: "none",
          scrollTrigger: {
            trigger: crawlerScene,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5,
          },
        });
      }

      // 3. PREPARATION Scene: Merchant World Entry & Package Overlap
      const prepScene = document.querySelector('[data-scene="preparation"]');
      const merchantWorld = document.querySelector('[data-actor="merchant-world"]');
      const packageActor = document.querySelector('[data-actor="package-actor"]');
      const prepCopy = document.querySelector('[data-actor="prep-copy"]');

      if (prepScene && merchantWorld) {
        const prepTl = gsap.timeline({
          scrollTrigger: {
            trigger: prepScene,
            start: "top 80%",
            end: "bottom center",
            scrub: 0.6,
          },
        });

        prepTl
          .fromTo(
            merchantWorld,
            { scale: 0.92, yPercent: 10 },
            { scale: 1.04, yPercent: 0, ease: "power1.out" },
            0
          )
          .fromTo(
            packageActor,
            { yPercent: 30, scale: 0.88, opacity: 0.8 },
            { yPercent: -15, scale: 1, opacity: 1, ease: "power1.out" },
            0.1
          );

        if (prepCopy) {
          prepTl.to(prepCopy, { yPercent: -8, ease: "none" }, 0);
        }
      }

      // 4. PREPARE → HANDOFF: Multi-Slice Slicing / Vignette Reveal & Hold
      const handoffScene = document.querySelector('[data-scene="handoff"]');
      const slices = document.querySelectorAll('[data-slice-index]');
      const handoffCopy = document.querySelector('[data-actor="handoff-copy"]');

      if (handoffScene && slices.length > 0) {
        const handoffTl = gsap.timeline({
          scrollTrigger: {
            trigger: handoffScene,
            start: "top 70%",
            end: "center center",
            scrub: 0.5,
          },
        });

        slices.forEach((slice, idx) => {
          handoffTl.fromTo(
            slice,
            {
              yPercent: (idx % 2 === 0 ? 1 : -1) * 15,
              opacity: 0.7,
              scale: 0.95,
            },
            {
              yPercent: 0,
              opacity: 1,
              scale: 1,
              ease: "power2.out",
            },
            idx * 0.08
          );
        });

        if (handoffCopy) {
          handoffTl.fromTo(
            handoffCopy,
            { yPercent: 15, opacity: 0.6 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0
          );
        }
      }

      // 5. ROUTE → NETWORK: Map Hold / Road Movement
      const routeScene = document.querySelector('[data-scene="route"]');
      const routeRoad = document.querySelector('[data-actor="route-road"]');
      const routeMap = document.querySelector('[data-actor="route-map"]');

      if (routeScene && routeRoad) {
        const routeTl = gsap.timeline({
          scrollTrigger: {
            trigger: routeScene,
            start: "top 75%",
            end: "bottom top",
            scrub: 0.5,
          },
        });

        // Map holds while road documentary moves
        routeTl
          .to(routeRoad, { yPercent: -18, scale: 1.04, ease: "none" }, 0)
          .fromTo(routeMap, { scale: 0.98 }, { scale: 1, ease: "none" }, 0);
      }

      // 6. NETWORK Field Spatial Float
      const networkScene = document.querySelector('[data-scene="network"]');
      const networkField = document.querySelector('[data-actor="network-field"]');

      if (networkScene && networkField) {
        gsap.to(networkField, {
          yPercent: -10,
          ease: "none",
          scrollTrigger: {
            trigger: networkScene,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // 7. ARRIVAL → FINALE Clean Handoff
      const arrivalScene = document.querySelector('[data-scene="arrival"]');
      const arrivalMedia = document.querySelector('[data-actor="arrival-media"]');
      const arrivalCopy = document.querySelector('[data-actor="arrival-copy"]');

      if (arrivalScene && arrivalMedia) {
        const arrivalTl = gsap.timeline({
          scrollTrigger: {
            trigger: arrivalScene,
            start: "top 80%",
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
            { yPercent: 12, opacity: 0.7 },
            { yPercent: 0, opacity: 1, ease: "power1.out" },
            0.1
          );
      }
    }, rootRef);

    return () => {
      ctx.revert();
    };
  }, [prefersReducedMotion]);

  return <div ref={rootRef} style={{ display: "contents" }} />;
}
