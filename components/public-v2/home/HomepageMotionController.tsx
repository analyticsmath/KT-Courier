"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/components/public-v2/motion/gsap-public";

export function HomepageMotionController() {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || isInitialized.current) return;
    isInitialized.current = true;

    const mm = gsap.matchMedia();

    // 1. Desktop & Wide Viewports (>= 1024px)
    mm.add("(min-width: 1024px)", () => {
      // Hero Entrance
      const heroCard = document.querySelector("[data-actor='hero-card']");
      const heroCutout = document.querySelector("[data-actor='hero-cutout']");
      const heroNeighbor = document.querySelector("[data-actor='hero-neighbor']");

      if (heroCard) {
        gsap.fromTo(
          heroCard,
          { y: 32, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", delay: 0.1 }
        );
      }
      if (heroCutout) {
        gsap.fromTo(
          heroCutout,
          { y: 48, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.0, ease: "power2.out", delay: 0.3 }
        );
      }
      if (heroNeighbor) {
        gsap.fromTo(
          heroNeighbor,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", delay: 0.4 }
        );
      }

      // Preparation & Handoff Scroll Timeline
      const prepScene = document.querySelector("[data-scene='preparation']");
      const prepMedia = document.querySelector("[data-actor='prep-media']");
      const handoffOverlay = document.querySelector("[data-actor='handoff-overlay']");
      const motionToken = document.querySelector("[data-actor='motion-token']");

      if (prepScene && prepMedia) {
        const prepTl = gsap.timeline({
          scrollTrigger: {
            trigger: prepScene,
            start: "top 70%",
            end: "bottom 30%",
            scrub: 0.8,
          },
        });

        if (handoffOverlay) {
          prepTl.fromTo(
            handoffOverlay,
            { x: 40, y: 40, opacity: 0.6, scale: 0.95 },
            { x: 0, y: 0, opacity: 1, scale: 1, ease: "none" },
            0
          );
        }
        if (motionToken) {
          prepTl.fromTo(
            motionToken,
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, ease: "none" },
            0.3
          );
        }
      }

      // Route Parallax Timeline
      const routeScene = document.querySelector("[data-scene='route']");
      const routeRoad = document.querySelector("[data-actor='route-road']");

      if (routeScene && routeRoad) {
        gsap.fromTo(
          routeRoad,
          { y: 24 },
          {
            y: -24,
            ease: "none",
            scrollTrigger: {
              trigger: routeScene,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      }

      // Arrival Calm Resolution
      const arrivalScene = document.querySelector("[data-scene='arrival']");
      const arrivalImage = document.querySelector("[data-actor='arrival-image']");

      if (arrivalScene && arrivalImage) {
        gsap.fromTo(
          arrivalImage,
          { y: 40, opacity: 0.7 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: {
              trigger: arrivalScene,
              start: "top 75%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    });

    // 2. Medium Viewports (768px - 1023px)
    mm.add("(min-width: 768px) and (max-width: 1023px)", () => {
      const heroCard = document.querySelector("[data-actor='hero-card']");
      if (heroCard) {
        gsap.fromTo(
          heroCard,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" }
        );
      }
    });

    // 3. Compact Viewports (<= 767px) - Native progressive reveals only
    mm.add("(max-width: 767px)", () => {
      const heroCard = document.querySelector("[data-actor='hero-card']");
      if (heroCard) {
        gsap.fromTo(
          heroCard,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
        );
      }
    });

    // 4. Prefers Reduced Motion
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(
        "[data-actor='hero-card'], [data-actor='hero-cutout'], [data-actor='hero-neighbor'], [data-actor='handoff-overlay'], [data-actor='motion-token'], [data-actor='route-road'], [data-actor='arrival-image']",
        { opacity: 1, x: 0, y: 0, scale: 1, clearProps: "all" }
      );
    });

    return () => {
      mm.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      isInitialized.current = false;
    };
  }, []);

  return null;
}
