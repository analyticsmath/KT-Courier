"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionContext } from "../motion/PublicMotionProvider";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface MasterHomeTimelineProps {
  rootRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Master Experience State Controller.
 * Coordinates five linked cinematic chapters without creating a brittle 10,000px monolithic timeline:
 * 1. Hero → Commerce Takeover
 * 2. Choice → Van Collection
 * 3. Custody Transfer → Road Geometry
 * 4. Route → Freight Climax → Arrival
 * 5. Handoff → Finale Resolution
 *
 * Enforces concealment rules: State swaps happen behind typography, trailer body, or road geometry.
 * Disables pinning on prefers-reduced-motion.
 */
export function useMasterHomeTimeline({ rootRef }: MasterHomeTimelineProps) {
  const { prefersReducedMotion } = useMotionContext();
  const timelineCtxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !rootRef.current || prefersReducedMotion) {
      return;
    }

    const ctx = gsap.context(() => {
      // ---------------------------------------------------------------------
      // Chapter 1: Hero Truck Entrance, Settling, and Trailer Takeover
      // ---------------------------------------------------------------------
      const heroSection = rootRef.current?.querySelector<HTMLElement>("[data-kt-scene='hero']");
      const heroTruck = heroSection?.querySelector<HTMLElement>(".heroTruck");
      const ktWord = heroSection?.querySelector<HTMLElement>(".heroWordKt");
      const courierWord = heroSection?.querySelector<HTMLElement>(".heroWordCourier");
      const heroActions = heroSection?.querySelector<HTMLElement>(".heroActionsRow");

      if (heroSection && heroTruck) {
        const isMobile = window.innerWidth < 768;

        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: isMobile ? "+=100%" : "+=160%",
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        // 0–0.38: Side truck moves into frame, type counter-moves at 8–12%
        if (!isMobile) {
          heroTl.fromTo(
            heroTruck,
            { x: "-18vw", opacity: 0.95 },
            { x: "2vw", opacity: 1, duration: 0.38, ease: "power2.out" },
            0
          );
          if (ktWord) {
            heroTl.fromTo(
              ktWord,
              { x: "2vw" },
              { x: "-1.5vw", duration: 0.38, ease: "none" },
              0
            );
          }
          if (courierWord) {
            heroTl.fromTo(
              courierWord,
              { x: "-2vw" },
              { x: "1.5vw", duration: 0.38, ease: "none" },
              0
            );
          }
        } else {
          // Mobile: truck remains 100% visible inside screen, slight vertical settling
          heroTl.fromTo(
            heroTruck,
            { y: "15px", scale: 0.97 },
            { y: "0px", scale: 1, duration: 0.38, ease: "power2.out" },
            0
          );
        }

        // 0.38–0.60: Settle and hold actions
        heroTl.to(heroActions || {}, { opacity: 1, duration: 0.22 }, 0.38);

        // 0.66–1.00: Acceleration into trailer takeover
        heroTl.to(
          heroTruck,
          {
            scale: isMobile ? 1.08 : 1.35,
            x: isMobile ? "-4vw" : "12vw",
            y: isMobile ? "-10px" : "-20px",
            duration: 0.34,
            ease: "power2.in",
          },
          0.66
        );

        if (heroActions) {
          heroTl.to(heroActions, { opacity: 0, y: 15, duration: 0.2 }, 0.66);
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 2: Marketplace Panels & Choice to Parcel
      // ---------------------------------------------------------------------
      const marketSection = rootRef.current?.querySelector<HTMLElement>("[data-kt-scene='marketplace']");
      if (marketSection && window.innerWidth >= 900) {
        ScrollTrigger.create({
          trigger: marketSection,
          start: "top 80%",
          end: "bottom 20%",
          onEnter: () => {
            // Smoothly engage marketplace scene
          },
        });
      }

      // ---------------------------------------------------------------------
      // Chapter 3: Van Collection & Custody Seam
      // ---------------------------------------------------------------------
      const collectionSection = rootRef.current?.querySelector<HTMLElement>("[data-kt-scene='collection']");
      const vanActor = collectionSection?.querySelector<HTMLElement>(".kt-van-actor");
      const courierActor = collectionSection?.querySelector<HTMLElement>(".kt-courier-actor");

      if (collectionSection && vanActor) {
        const collectTl = gsap.timeline({
          scrollTrigger: {
            trigger: collectionSection,
            start: "top 75%",
            end: "bottom 50%",
            scrub: 0.5,
          },
        });

        // Van stops, courier steps up
        collectTl.fromTo(
          vanActor,
          { x: "-8vw", opacity: 0.85 },
          { x: "0vw", opacity: 1, duration: 0.4, ease: "power2.out" },
          0
        );

        if (courierActor) {
          collectTl.fromTo(
            courierActor,
            { x: "6vw", opacity: 0 },
            { x: "0vw", opacity: 1, duration: 0.4, ease: "power2.out" },
            0.25
          );
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 4: Route Overhead Continuity & Freight Climax
      // ---------------------------------------------------------------------
      const routeSection = rootRef.current?.querySelector<HTMLElement>("[data-kt-scene='route']");
      const topTruck = routeSection?.querySelector<HTMLElement>(".kt-white-truck-actor");

      if (routeSection && topTruck) {
        gsap.fromTo(
          topTruck,
          { y: "-40px" },
          {
            y: "40px",
            ease: "none",
            scrollTrigger: {
              trigger: routeSection,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }

      const freightSection = rootRef.current?.querySelector<HTMLElement>("[data-kt-scene='freight']");
      const redTruck = freightSection?.querySelector<HTMLElement>(".kt-red-truck-actor");

      if (freightSection && redTruck) {
        gsap.fromTo(
          redTruck,
          { scale: 0.94, y: "30px", opacity: 0.9 },
          {
            scale: 1,
            y: "0px",
            opacity: 1,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: freightSection,
              start: "top 70%",
              end: "center center",
              scrub: 0.5,
            },
          }
        );
      }

      // ---------------------------------------------------------------------
      // Chapter 5: Doorstep Arrival & Monumental Finale Resolution
      // ---------------------------------------------------------------------
      const arrivalSection = rootRef.current?.querySelector<HTMLElement>("[data-kt-scene='arrival']");
      const arrivalCourier = arrivalSection?.querySelector<HTMLElement>(".kt-courier-actor");

      if (arrivalSection && arrivalCourier) {
        gsap.fromTo(
          arrivalCourier,
          { scale: 0.95, opacity: 0.85 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: {
              trigger: arrivalSection,
              start: "top 75%",
              end: "center center",
              scrub: 0.4,
            },
          }
        );
      }

      const finaleSection = rootRef.current?.querySelector<HTMLElement>("[data-kt-scene='finale']");
      const finaleTitle = finaleSection?.querySelector<HTMLElement>("h2");

      if (finaleSection && finaleTitle) {
        gsap.fromTo(
          finaleTitle,
          { scale: 0.96, opacity: 0.7 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: {
              trigger: finaleSection,
              start: "top 80%",
              end: "center center",
              scrub: 0.5,
            },
          }
        );
      }
    }, rootRef);

    timelineCtxRef.current = ctx;

    return () => {
      ctx.revert();
    };
  }, [rootRef, prefersReducedMotion]);
}
