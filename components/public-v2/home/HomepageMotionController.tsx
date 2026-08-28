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
      // 1. Hero Parallax & Cutout Actor Carry
      const heroEnv = document.querySelector('[data-actor="hero-env"]');
      const heroPlane = document.querySelector('[data-actor="hero-plane"]');
      const heroCutout = document.querySelector('[data-actor="hero-cutout"]');
      const heroNeighbor = document.querySelector('[data-actor="hero-neighbor"]');

      if (heroEnv && heroPlane) {
        gsap.to(heroEnv, {
          yPercent: 15,
          scale: 1.05,
          ease: "none",
          scrollTrigger: {
            trigger: '[data-scene="hero"]',
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        gsap.to(heroPlane, {
          yPercent: -10,
          opacity: 0.85,
          ease: "none",
          scrollTrigger: {
            trigger: '[data-scene="hero"]',
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        if (heroCutout) {
          gsap.to(heroCutout, {
            xPercent: 12,
            yPercent: -18,
            ease: "none",
            scrollTrigger: {
              trigger: '[data-scene="hero"]',
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });
        }

        if (heroNeighbor) {
          gsap.to(heroNeighbor, {
            yPercent: -25,
            ease: "none",
            scrollTrigger: {
              trigger: '[data-scene="hero"]',
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });
        }
      }

      // 2. Crawler Stage Transitions
      const crawlerScene = document.querySelector('[data-scene="crawler"]');
      const crawlerTrack = document.querySelector('[data-actor="crawler-track"]');
      const crawlerItems = document.querySelectorAll("[data-crawler-item]");

      if (crawlerScene && crawlerTrack && crawlerItems.length > 0) {
        gsap.to(crawlerTrack, {
          xPercent: -45,
          ease: "power1.inOut",
          scrollTrigger: {
            trigger: crawlerScene,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
          },
        });
      }

      // 3. Prepare -> Handoff Scene Overlap & Slicing
      const prepScene = document.querySelector('[data-scene="preparation"]');
      const merchantWorld = document.querySelector('[data-actor="merchant-world"]');
      const packageActor = document.querySelector('[data-actor="package-actor"]');

      if (prepScene && merchantWorld) {
        gsap.to(merchantWorld, {
          scale: 1.06,
          yPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: prepScene,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });

        if (packageActor) {
          gsap.to(packageActor, {
            yPercent: -20,
            xPercent: -8,
            ease: "none",
            scrollTrigger: {
              trigger: prepScene,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          });
        }
      }

      // 4. Handoff Frame Scale & Hold
      const handoffScene = document.querySelector('[data-scene="handoff"]');
      const handoffFrame = document.querySelector('[data-actor="handoff-frame"]');

      if (handoffScene && handoffFrame) {
        gsap.fromTo(
          handoffFrame,
          { scale: 0.94, clipPath: "inset(4% 4% 4% 4%)" },
          {
            scale: 1,
            clipPath: "inset(0% 0% 0% 0%)",
            ease: "power2.out",
            scrollTrigger: {
              trigger: handoffScene,
              start: "top 75%",
              end: "center center",
              scrub: 0.5,
            },
          }
        );
      }

      // 5. Route Road Movement (One side stops while the other moves)
      const routeScene = document.querySelector('[data-scene="route"]');
      const routeRoad = document.querySelector('[data-actor="route-road"]');

      if (routeScene && routeRoad) {
        gsap.to(routeRoad, {
          yPercent: -12,
          ease: "none",
          scrollTrigger: {
            trigger: routeScene,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // 6. Network Asymmetric Field Drift
      const networkScene = document.querySelector('[data-scene="network"]');
      const networkField = document.querySelector('[data-actor="network-field"]');

      if (networkScene && networkField) {
        gsap.to(networkField, {
          yPercent: -6,
          ease: "none",
          scrollTrigger: {
            trigger: networkScene,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // 7. Arrival Resolution Settle
      const arrivalScene = document.querySelector('[data-scene="arrival"]');
      const arrivalMedia = document.querySelector('[data-actor="arrival-media"]');

      if (arrivalScene && arrivalMedia) {
        gsap.fromTo(
          arrivalMedia,
          { scale: 0.96, yPercent: 6 },
          {
            scale: 1,
            yPercent: 0,
            ease: "power1.out",
            scrollTrigger: {
              trigger: arrivalScene,
              start: "top 80%",
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
