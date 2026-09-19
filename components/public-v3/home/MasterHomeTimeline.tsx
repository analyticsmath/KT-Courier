"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionContext } from "../motion/PublicMotionProvider";
import type {
  WhiteTruckStateId,
  VanStateId,
  CourierStateId,
  RedTruckStateId,
} from "../actors/actor-state-machine";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export interface MasterHomeTimelineProps {
  rootRef: React.RefObject<HTMLDivElement | null>;
  onWhiteTruckStateChange?: (state: WhiteTruckStateId) => void;
  onVanStateChange?: (state: VanStateId) => void;
  onCourierStateChange?: (state: CourierStateId) => void;
  onRedTruckStateChange?: (state: RedTruckStateId) => void;
  onActiveActorChange?: (actor: "white-truck" | "van" | "courier" | "red-truck" | null) => void;
  onMarketplaceActiveIdChange?: (id: string) => void;
}

/**
 * Master Experience Controller (v3).
 * Coordinates persistent actor continuity and cinematic transitions across 9 linked scenes:
 * 1. Hero: Complete white truck silhouette (desktop entrance, strictly constrained mobile view without clipping)
 * 2. Trailer Takeover: Physical cargo rectangle expands across viewport into marketplace commerce
 * 3. Marketplace: Scroll-choreographed five-panel expansion with touch-safe mobile snap rail
 * 4. Choice -> Parcel: Contraction of selected commerce aperture into preparation parcel
 * 5. Van Collection: Van arrives closed -> settles -> door opens under seam -> courier loads
 * 6. Custody Split: Courier bridges merchant handoff and transit seam
 * 7. Route: Concealed swap to top-down straight truck traversing asphalt lane
 * 8. Freight: Red freight truck commands center plane
 * 9. Arrival: Courier extending handoff at quiet human doorstep
 */
export function useMasterHomeTimeline({
  rootRef,
  onWhiteTruckStateChange,
  onVanStateChange,
  onCourierStateChange,
  onRedTruckStateChange,
  onActiveActorChange,
  onMarketplaceActiveIdChange,
}: MasterHomeTimelineProps) {
  const { prefersReducedMotion } = useMotionContext();
  const timelineCtxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !rootRef.current || prefersReducedMotion) {
      return;
    }

    const ctx = gsap.context(() => {
      const container = rootRef.current;
      if (!container) return;

      // ---------------------------------------------------------------------
      // Actor Slot Elements (Mounted once in PersistentActorLayer)
      // ---------------------------------------------------------------------
      const whiteTruckSlot = container.querySelector<HTMLElement>(".actor-slot-white-truck");
      const vanSlot = container.querySelector<HTMLElement>(".actor-slot-van");
      const courierSlot = container.querySelector<HTMLElement>(".actor-slot-courier");
      const redTruckSlot = container.querySelector<HTMLElement>(".actor-slot-red-truck");
      const trailerOverlay = container.querySelector<HTMLElement>(".kt-trailer-takeover-plane");

      // ---------------------------------------------------------------------
      // Anchor Targets (Provided by scenes for spatial positioning)
      // ---------------------------------------------------------------------
      const heroAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='hero-truck']");
      const collectionVanAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='collection-van']");
      const collectionCourierAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='collection-courier']");
      const custodyCourierAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='custody-courier']");
      const routeAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='route-truck']");
      const freightAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='freight-truck']");
      const arrivalCourierAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='arrival-courier']");

      // Helper: Position an actor slot to match anchor geometry in container space
      const alignSlotToAnchor = (slot: HTMLElement | null, anchor: HTMLElement | null) => {
        if (!slot || !anchor || !container) return;
        const cRect = container.getBoundingClientRect();
        const aRect = anchor.getBoundingClientRect();
        gsap.set(slot, {
          top: aRect.top - cRect.top,
          left: aRect.left - cRect.left,
          width: aRect.width,
          height: aRect.height,
          position: "absolute",
        });
      };

      // Initial anchor measurements
      const updateAllAnchorPositions = () => {
        alignSlotToAnchor(whiteTruckSlot, heroAnchor);
        alignSlotToAnchor(vanSlot, collectionVanAnchor);
        alignSlotToAnchor(courierSlot, collectionCourierAnchor);
        alignSlotToAnchor(redTruckSlot, freightAnchor);
      };

      updateAllAnchorPositions();
      ScrollTrigger.addEventListener("refresh", updateAllAnchorPositions);
      window.addEventListener("resize", updateAllAnchorPositions);

      // ---------------------------------------------------------------------
      // Chapter 1: Hero Truck & Real Trailer Takeover
      // ---------------------------------------------------------------------
      const heroSection = container.querySelector<HTMLElement>("[data-kt-scene='hero']");
      const ktWord = heroSection?.querySelector<HTMLElement>(".heroWordKt");
      const courierWord = heroSection?.querySelector<HTMLElement>(".heroWordCourier");
      const heroActions = heroSection?.querySelector<HTMLElement>(".heroActionsRow");

      if (heroSection && whiteTruckSlot) {
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
            onEnter: () => {
              onActiveActorChange?.("white-truck");
              alignSlotToAnchor(whiteTruckSlot, heroAnchor);
            },
            onEnterBack: () => {
              onActiveActorChange?.("white-truck");
              onWhiteTruckStateChange?.("wide-hero");
              alignSlotToAnchor(whiteTruckSlot, heroAnchor);
            },
          },
        });

        // 0–0.38: Side truck enters/settles into frame
        if (!isMobile) {
          heroTl.fromTo(
            whiteTruckSlot,
            { x: "-16vw", opacity: 0.95 },
            {
              x: "0vw",
              opacity: 1,
              duration: 0.38,
              ease: "power2.out",
              onComplete: () => {
                onWhiteTruckStateChange?.("side-right");
              },
            },
            0
          );
          if (ktWord) {
            heroTl.fromTo(ktWord, { x: "2vw" }, { x: "-1.5vw", duration: 0.38, ease: "none" }, 0);
          }
          if (courierWord) {
            heroTl.fromTo(courierWord, { x: "-2vw" }, { x: "1.5vw", duration: 0.38, ease: "none" }, 0);
          }
        } else {
          // Mobile rule: scale never exceeds 1.0, x never causes clipping at 360–430px
          heroTl.fromTo(
            whiteTruckSlot,
            { y: "12px", scale: 0.98, opacity: 0.95 },
            {
              y: "0px",
              scale: 1.0,
              x: "0px",
              opacity: 1,
              duration: 0.38,
              ease: "power2.out",
              onComplete: () => {
                onWhiteTruckStateChange?.("side-right");
              },
            },
            0
          );
        }

        // 0.38–0.60: Settle and hold actions
        if (heroActions) {
          heroTl.to(heroActions, { opacity: 1, duration: 0.22 }, 0.38);
        }

        // 0.66–1.00: Acceleration into Trailer Takeover
        heroTl.to(
          whiteTruckSlot,
          {
            scale: isMobile ? 1.0 : 1.28,
            x: isMobile ? "0px" : "14vw",
            y: isMobile ? "-8px" : "-16px",
            duration: 0.34,
            ease: "power2.in",
            onStart: () => {
              onWhiteTruckStateChange?.("cargo-box-close");
            },
          },
          0.66
        );

        if (heroActions) {
          heroTl.to(heroActions, { opacity: 0, y: 15, duration: 0.2 }, 0.66);
        }

        // Trailer Takeover: expands trailer rectangle to full viewport
        if (trailerOverlay) {
          heroTl.fromTo(
            trailerOverlay,
            {
              clipPath: isMobile
                ? "inset(32% 12% 28% 12%)"
                : "inset(24% 20% 24% 20%)",
              opacity: 0,
            },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              opacity: 1,
              duration: 0.34,
              ease: "power2.inOut",
            },
            0.66
          );
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 2: Five-Panel Marketplace Scroll Choreography
      // ---------------------------------------------------------------------
      const marketSection = container.querySelector<HTMLElement>("[data-kt-scene='marketplace']");
      if (marketSection && window.innerWidth >= 900) {
        const categoryIds = ["fashion", "food", "grocery", "home", "wellness"];

        ScrollTrigger.create({
          trigger: marketSection,
          start: "top top",
          end: "+=120%",
          pin: true,
          scrub: 0.5,
          onEnter: () => {
            onActiveActorChange?.(null);
            if (trailerOverlay) gsap.to(trailerOverlay, { opacity: 0, duration: 0.2 });
          },
          onUpdate: (self) => {
            const index = Math.min(
              categoryIds.length - 1,
              Math.floor(self.progress * categoryIds.length)
            );
            const activeId = categoryIds[index];
            if (activeId) {
              onMarketplaceActiveIdChange?.(activeId);
            }
          },
        });
      }

      // ---------------------------------------------------------------------
      // Chapter 4: Local Collection — Van Closed -> Open -> Courier Load
      // ---------------------------------------------------------------------
      const collectionSection = container.querySelector<HTMLElement>("[data-kt-scene='collection']");

      if (collectionSection && vanSlot) {
        const collectTl = gsap.timeline({
          scrollTrigger: {
            trigger: collectionSection,
            start: "top 75%",
            end: "bottom 50%",
            scrub: 0.5,
            onEnter: () => {
              alignSlotToAnchor(vanSlot, collectionVanAnchor);
              alignSlotToAnchor(courierSlot, collectionCourierAnchor);
              onActiveActorChange?.("van");
              onVanStateChange?.("side-right");
            },
          },
        });

        // Van enters closed and settles into position
        collectTl.fromTo(
          vanSlot,
          { x: "-8vw", opacity: 0.85 },
          {
            x: "0vw",
            opacity: 1,
            duration: 0.4,
            ease: "power2.out",
            onComplete: () => {
              // Settle hold -> state swap under body/door seam to sliding-door-open
              onVanStateChange?.("sliding-door-open");
              // Once door is open, courier loading state becomes active
              onActiveActorChange?.("courier");
              onCourierStateChange?.("loading-unloading");
            },
          },
          0
        );

        if (courierSlot) {
          collectTl.fromTo(
            courierSlot,
            { x: "6vw", opacity: 0 },
            {
              x: "0vw",
              opacity: 1,
              duration: 0.35,
              ease: "power2.out",
            },
            0.3
          );
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 5: Custody Transfer Seam
      // ---------------------------------------------------------------------
      const custodySection = container.querySelector<HTMLElement>("[data-kt-scene='custody']");
      if (custodySection && courierSlot) {
        ScrollTrigger.create({
          trigger: custodySection,
          start: "top 70%",
          end: "bottom 30%",
          onEnter: () => {
            alignSlotToAnchor(courierSlot, custodyCourierAnchor);
            onActiveActorChange?.("courier");
            onCourierStateChange?.("ready-handover");
          },
          onEnterBack: () => {
            alignSlotToAnchor(courierSlot, custodyCourierAnchor);
            onActiveActorChange?.("courier");
            onCourierStateChange?.("ready-handover");
          },
        });
      }

      // ---------------------------------------------------------------------
      // Chapter 6: Route Overhead Continuity (Top-Down Straight Truck)
      // ---------------------------------------------------------------------
      const routeSection = container.querySelector<HTMLElement>("[data-kt-scene='route']");
      if (routeSection && whiteTruckSlot) {
        ScrollTrigger.create({
          trigger: routeSection,
          start: "top 80%",
          end: "bottom 20%",
          onEnter: () => {
            alignSlotToAnchor(whiteTruckSlot, routeAnchor);
            onActiveActorChange?.("white-truck");
            onWhiteTruckStateChange?.("top-down-straight");
          },
          onEnterBack: () => {
            alignSlotToAnchor(whiteTruckSlot, routeAnchor);
            onActiveActorChange?.("white-truck");
            onWhiteTruckStateChange?.("top-down-straight");
          },
        });

        gsap.fromTo(
          whiteTruckSlot,
          { y: "-30px" },
          {
            y: "30px",
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

      // ---------------------------------------------------------------------
      // Chapter 7: Heavy Freight Network Climax (Red Freight Truck)
      // ---------------------------------------------------------------------
      const freightSection = container.querySelector<HTMLElement>("[data-kt-scene='freight']");
      if (freightSection && redTruckSlot) {
        ScrollTrigger.create({
          trigger: freightSection,
          start: "top 75%",
          end: "bottom 25%",
          onEnter: () => {
            alignSlotToAnchor(redTruckSlot, freightAnchor);
            onActiveActorChange?.("red-truck");
            onRedTruckStateChange?.("centered-hero");
          },
          onEnterBack: () => {
            alignSlotToAnchor(redTruckSlot, freightAnchor);
            onActiveActorChange?.("red-truck");
            onRedTruckStateChange?.("centered-hero");
          },
        });

        gsap.fromTo(
          redTruckSlot,
          { scale: 0.95, y: "24px", opacity: 0.9 },
          {
            scale: 1,
            y: "0px",
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: freightSection,
              start: "top 65%",
              end: "center center",
              scrub: 0.5,
            },
          }
        );
      }

      // ---------------------------------------------------------------------
      // Chapter 8: Doorstep Arrival & Physical Handoff
      // ---------------------------------------------------------------------
      const arrivalSection = container.querySelector<HTMLElement>("[data-kt-scene='arrival']");
      if (arrivalSection && courierSlot) {
        ScrollTrigger.create({
          trigger: arrivalSection,
          start: "top 75%",
          end: "bottom 25%",
          onEnter: () => {
            alignSlotToAnchor(courierSlot, arrivalCourierAnchor);
            onActiveActorChange?.("courier");
            onCourierStateChange?.("extending-handoff");
          },
          onEnterBack: () => {
            alignSlotToAnchor(courierSlot, arrivalCourierAnchor);
            onActiveActorChange?.("courier");
            onCourierStateChange?.("extending-handoff");
          },
        });

        gsap.fromTo(
          courierSlot,
          { y: "20px", opacity: 0.85 },
          {
            y: "0px",
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: arrivalSection,
              start: "top 70%",
              end: "center center",
              scrub: 0.5,
            },
          }
        );
      }
    }, rootRef);

    timelineCtxRef.current = ctx;

    return () => {
      ScrollTrigger.removeEventListener("refresh", () => {});
      window.removeEventListener("resize", () => {});
      ctx.revert();
    };
  }, [
    rootRef,
    prefersReducedMotion,
    onWhiteTruckStateChange,
    onVanStateChange,
    onCourierStateChange,
    onRedTruckStateChange,
    onActiveActorChange,
    onMarketplaceActiveIdChange,
  ]);
}
