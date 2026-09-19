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
import type { ActorVisibility } from "../actors/PersistentActorLayer";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export type HeroMarketOwnership =
  | "hero"
  | "takeover"
  | "handoff"
  | "marketplace"
  | "released";

export interface MasterHomeTimelineProps {
  rootRef: React.RefObject<HTMLDivElement | null>;
  onWhiteTruckStateChange?: (state: WhiteTruckStateId) => void;
  onVanStateChange?: (state: VanStateId) => void;
  onCourierStateChange?: (state: CourierStateId) => void;
  onRedTruckStateChange?: (state: RedTruckStateId) => void;
  onActiveActorChange?: (actor: "white-truck" | "van" | "courier" | "red-truck" | null) => void;
  onActorVisibilityChange?: (visibility: Partial<ActorVisibility>) => void;
  onMarketplaceActiveIdChange?: (id: string) => void;
}

/**
 * Master Experience Controller (v3 — Final Live Cinematic Motion Correction Engine).
 *
 * Core Invariant:
 * Given only the current scroll position, the application reconstructs the exact valid visual state.
 *
 * 1. Deterministic Ownership: Exactly one visual owner exists for the trailer takeover plane:
 *    HERO_WORLD -> TRAILER_ENTERING -> TRAILER_OWNS_VIEWPORT -> MARKETPLACE_HANDOFF -> MARKETPLACE_OWNS_VIEWPORT -> MARKETPLACE_RELEASED.
 *    At any point past Marketplace (or 100% page scroll), .kt-trailer-takeover-plane is strictly autoAlpha: 0.
 * 2. Stable Hero Actor: White truck stays wide-hero through Hero takeover. Takeover plane expands from
 *    measured trailerMaskAnchor bounding rect and provides the cargo box aperture.
 * 3. Scroll-Only Marketplace: Single controller with proportional widths (54% active, 11.5% each inactive).
 * 4. Shared Media Handoff: Terminal Marketplace active image directly inherits into Fan hero card.
 * 5. Continuous Van Door Aperture: Dom door window permanently clipped to door region; Collection GSAP timeline
 *    owns smooth bidirectional scrub without CSS lag.
 * 6. Concealed Transformations: Custody -> Route conceals top-down truck; Route overpass conceals turning state;
 *    Freight red truck reveals only after white truck exits.
 */
export function useMasterHomeTimeline({
  rootRef,
  onWhiteTruckStateChange,
  onVanStateChange,
  onCourierStateChange,
  onRedTruckStateChange,
  onActiveActorChange,
  onActorVisibilityChange,
  onMarketplaceActiveIdChange,
}: MasterHomeTimelineProps) {
  const { prefersReducedMotion } = useMotionContext();
  const timelineCtxRef = useRef<gsap.Context | null>(null);

  // Maintain currently active scene anchors across resize & refresh
  const currentAnchors = useRef<{
    whiteTruck: HTMLElement | null;
    van: HTMLElement | null;
    courier: HTMLElement | null;
    redTruck: HTMLElement | null;
  }>({
    whiteTruck: null,
    van: null,
    courier: null,
    redTruck: null,
  });

  // State-deduplication refs to prevent redundant React re-renders
  const lastActiveActorRef = useRef<string | null>(null);
  const lastVisibilityRef = useRef<string>("");
  const lastWhiteTruckStateRef = useRef<WhiteTruckStateId>("wide-hero");
  const lastVanStateRef = useRef<VanStateId>("side-right");
  const lastCourierStateRef = useRef<CourierStateId>("look-right-approach");
  const lastRedTruckStateRef = useRef<RedTruckStateId>("centered-hero");
  const lastMarketplaceIdRef = useRef<string>("fashion");

  useEffect(() => {
    if (typeof window === "undefined" || !rootRef.current || prefersReducedMotion) {
      return;
    }

    let handleRefreshOrResize: () => void = () => {};
    let handleRefreshInit: () => void = () => {};

    const ctx = gsap.context(() => {
      const container = rootRef.current;
      if (!container) return;

      // ---------------------------------------------------------------------
      // DOM Elements & Slots
      // ---------------------------------------------------------------------
      const whiteTruckSlot = container.querySelector<HTMLElement>(".actor-slot-white-truck");
      const vanSlot = container.querySelector<HTMLElement>(".actor-slot-van");
      const courierSlot = container.querySelector<HTMLElement>(".actor-slot-courier");
      const redTruckSlot = container.querySelector<HTMLElement>(".actor-slot-red-truck");
      const trailerOverlay = container.querySelector<HTMLElement>(".kt-trailer-takeover-plane");

      // Progression Layers in Trailer Takeover
      const p1Layer = trailerOverlay?.querySelector<HTMLElement>(".takeover-progression-1");
      const p3Layer = trailerOverlay?.querySelector<HTMLElement>(".takeover-progression-3");
      const p5Layer = trailerOverlay?.querySelector<HTMLElement>(".takeover-progression-5");
      const p3Panels = trailerOverlay?.querySelectorAll<HTMLElement>("[data-takeover-p3-panel]");
      const p5Panels = trailerOverlay?.querySelectorAll<HTMLElement>("[data-takeover-p5-panel]");

      // Scene Sections
      const heroSection = container.querySelector<HTMLElement>("[data-kt-scene='hero']");
      const marketSection = container.querySelector<HTMLElement>("[data-kt-scene='marketplace']");
      const fanSection = container.querySelector<HTMLElement>("[data-kt-scene='image-fan']");
      const prepSection = container.querySelector<HTMLElement>("[data-kt-scene='preparation']");
      const collectionSection = container.querySelector<HTMLElement>("[data-kt-scene='collection']");
      const custodySection = container.querySelector<HTMLElement>("[data-kt-scene='custody']");
      const routeSection = container.querySelector<HTMLElement>("[data-kt-scene='route']");
      const freightSection = container.querySelector<HTMLElement>("[data-kt-scene='freight']");
      const arrivalSection = container.querySelector<HTMLElement>("[data-kt-scene='arrival']");
      const finaleSection = container.querySelector<HTMLElement>("[data-kt-scene='finale']");

      // Scene Anchors
      const heroAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='hero-truck']");
      const trailerMaskAnchor = container.querySelector<HTMLElement>("[data-trailer-mask-anchor]");
      const collectionVanAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='collection-van']");
      const collectionCourierAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='collection-courier']");
      const custodyCourierAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='custody-courier']");
      const routeAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='route-truck']");
      const freightAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='freight-truck']");
      const arrivalCourierAnchor = container.querySelector<HTMLElement>("[data-actor-anchor='arrival-courier']");

      currentAnchors.current.whiteTruck = heroAnchor;
      currentAnchors.current.van = collectionVanAnchor;
      currentAnchors.current.courier = collectionCourierAnchor;
      currentAnchors.current.redTruck = freightAnchor;

      // Helper: Position actor slot to match anchor in container space
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

      const updateAllAnchorPositions = () => {
        alignSlotToAnchor(whiteTruckSlot, currentAnchors.current.whiteTruck || heroAnchor);
        alignSlotToAnchor(vanSlot, currentAnchors.current.van || collectionVanAnchor);
        alignSlotToAnchor(courierSlot, currentAnchors.current.courier || collectionCourierAnchor);
        alignSlotToAnchor(redTruckSlot, currentAnchors.current.redTruck || freightAnchor);
      };

      // Helper: Safely commit actor visibility with deduplication
      const setActorVisibilitySafe = (vis: ActorVisibility) => {
        const key = `${vis.whiteTruck}-${vis.van}-${vis.courier}-${vis.redTruck}`;
        if (lastVisibilityRef.current !== key) {
          lastVisibilityRef.current = key;
          onActorVisibilityChange?.(vis);
        }
      };

      // Helper: Safely commit active actor
      const setActiveActorSafe = (actor: "white-truck" | "van" | "courier" | "red-truck" | null) => {
        if (lastActiveActorRef.current !== actor) {
          lastActiveActorRef.current = actor;
          onActiveActorChange?.(actor);
        }
      };

      // Helper: Safely commit white truck state
      const setWhiteTruckStateSafe = (state: WhiteTruckStateId) => {
        if (lastWhiteTruckStateRef.current !== state) {
          lastWhiteTruckStateRef.current = state;
          onWhiteTruckStateChange?.(state);
        }
      };

      // Helper: Safely commit van state
      const setVanStateSafe = (state: VanStateId) => {
        if (lastVanStateRef.current !== state) {
          lastVanStateRef.current = state;
          onVanStateChange?.(state);
        }
      };

      // Helper: Safely commit courier state
      const setCourierStateSafe = (state: CourierStateId) => {
        if (lastCourierStateRef.current !== state) {
          lastCourierStateRef.current = state;
          onCourierStateChange?.(state);
        }
      };

      // Helper: Safely commit red truck state
      const setRedTruckStateSafe = (state: RedTruckStateId) => {
        if (lastRedTruckStateRef.current !== state) {
          lastRedTruckStateRef.current = state;
          onRedTruckStateChange?.(state);
        }
      };

      // Helper: Safely commit marketplace active ID
      const setMarketplaceActiveIdSafe = (id: string) => {
        if (lastMarketplaceIdRef.current !== id) {
          lastMarketplaceIdRef.current = id;
          onMarketplaceActiveIdChange?.(id);
        }
      };

      // Ensure takeover plane is initially autoAlpha: 0
      if (trailerOverlay) {
        gsap.set(trailerOverlay, { autoAlpha: 0 });
      }

      // ---------------------------------------------------------------------
      // Measured Trailer Takeover Pixel Anchor Calculation
      // ---------------------------------------------------------------------
      const getMeasuredTrailerRect = () => {
        if (!trailerMaskAnchor) {
          return {
            left: window.innerWidth * 0.18,
            top: window.innerHeight * 0.2,
            width: window.innerWidth * 0.5,
            height: window.innerHeight * 0.52,
          };
        }
        const r = trailerMaskAnchor.getBoundingClientRect();
        return {
          left: Math.max(0, r.left),
          top: Math.max(0, r.top),
          width: Math.max(10, r.width),
          height: Math.max(10, r.height),
        };
      };

      // ---------------------------------------------------------------------
      // Chapter 01: Hero Scene & Measured Material Takeover
      // ---------------------------------------------------------------------
      const isMobile = window.innerWidth < 768;
      const ktWord = heroSection?.querySelector<HTMLElement>(".heroWordKt");
      const courierWord = heroSection?.querySelector<HTMLElement>(".heroWordCourier");
      const heroActions = heroSection?.querySelector<HTMLElement>(".heroActionsRow");
      const heroRoadAtmosphere = heroSection?.querySelector<HTMLElement>(".kt-hero-road-atmosphere");

      let heroTrigger: ScrollTrigger | null = null;
      let marketTrigger: ScrollTrigger | null = null;

      if (heroSection && whiteTruckSlot) {
        const initialTrailerRect = getMeasuredTrailerRect();

        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: isMobile ? "+=110%" : "+=160%",
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress;
              // Deterministic Hero/Takeover state derived strictly from progress
              if (p < 0.64) {
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
                setWhiteTruckStateSafe("wide-hero");
                setActorVisibilitySafe({ whiteTruck: true, van: false, courier: false, redTruck: false });
                setActiveActorSafe("white-truck");
              } else if (p >= 0.64 && p <= 1.0) {
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1 });
                // Amendment 1: Keep wide-hero stable during takeover; do not swap to cargo-box-close
                setWhiteTruckStateSafe("wide-hero");
                setActorVisibilitySafe({ whiteTruck: true, van: false, courier: false, redTruck: false });
                setActiveActorSafe("white-truck");
              }
            },
          },
        });

        heroTrigger = heroTl.scrollTrigger ?? null;

        // 0.00–0.38: Approach / Settle
        // Fixed vertical baseline; truck 1.0 rate, environment ~1.15 opposite, typography ~0.20
        if (!isMobile) {
          heroTl.fromTo(
            whiteTruckSlot,
            { x: "-12vw", y: 0, scale: 1, opacity: 0.95 },
            { x: "0vw", y: 0, scale: 1, opacity: 1, duration: 0.38, ease: "power2.out" },
            0
          );
          if (heroRoadAtmosphere) {
            heroTl.fromTo(
              heroRoadAtmosphere,
              { x: "14vw" },
              { x: "0vw", duration: 0.38, ease: "power2.out" },
              0
            );
          }
          if (ktWord) {
            heroTl.fromTo(ktWord, { x: "2.5vw" }, { x: "-1vw", duration: 0.38, ease: "none" }, 0);
          }
          if (courierWord) {
            heroTl.fromTo(courierWord, { x: "-2.5vw" }, { x: "1vw", duration: 0.38, ease: "none" }, 0);
          }
        } else {
          heroTl.fromTo(
            whiteTruckSlot,
            { y: "10px", scale: 1.0, opacity: 0.95 },
            { y: "0px", scale: 1.0, x: "0px", opacity: 1, duration: 0.38, ease: "power2.out" },
            0
          );
        }

        // 0.38–0.64: Genuine Reading Hold (motion effectively still)
        if (heroActions) {
          heroTl.fromTo(heroActions, { opacity: 0.8 }, { opacity: 1, duration: 0.1 }, 0.38);
        }

        // 0.64–0.88: Material Takeover Expansion
        if (trailerOverlay) {
          // Initialize takeover overlay exactly at measured trailer cargo-box bounds in pixels
          heroTl.set(
            trailerOverlay,
            {
              left: initialTrailerRect.left,
              top: initialTrailerRect.top,
              width: initialTrailerRect.width,
              height: initialTrailerRect.height,
              autoAlpha: 1,
            },
            0.64
          );

          // Animate takeover plane to full viewport bounds
          heroTl.to(
            trailerOverlay,
            {
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              duration: 0.24,
              ease: "power2.inOut",
            },
            0.64
          );

          if (heroActions) {
            heroTl.to(heroActions, { opacity: 0, y: 15, duration: 0.15 }, 0.64);
          }

          // 1 -> 3 -> 5 Aperture Width Evolution
          // Progression 1 (single image) starts at 100%
          if (p1Layer && p3Layer) {
            heroTl.to(p1Layer, { autoAlpha: 0, duration: 0.08 }, 0.74);
            heroTl.to(p3Layer, { autoAlpha: 1, duration: 0.08 }, 0.74);
          }

          // 3-panel aperture expands: 0/100/0 -> 33.3/33.4/33.3
          if (p3Panels && p3Panels.length === 3) {
            heroTl.fromTo(
              p3Panels[0],
              { width: "0%" },
              { width: "33.3%", duration: 0.1, ease: "power1.inOut" },
              0.74
            );
            heroTl.fromTo(
              p3Panels[1],
              { width: "100%" },
              { width: "33.4%", duration: 0.1, ease: "power1.inOut" },
              0.74
            );
            heroTl.fromTo(
              p3Panels[2],
              { width: "0%" },
              { width: "33.3%", duration: 0.1, ease: "power1.inOut" },
              0.74
            );
          }

          // 5-panel aperture expands: 0/50/0/50/0 -> 20/20/20/20/20
          if (p3Layer && p5Layer) {
            heroTl.to(p3Layer, { autoAlpha: 0, duration: 0.06 }, 0.84);
            heroTl.to(p5Layer, { autoAlpha: 1, duration: 0.06 }, 0.84);
          }

          if (p5Panels && p5Panels.length === 5) {
            heroTl.fromTo(
              p5Panels[0],
              { width: "0%" },
              { width: "20%", duration: 0.08, ease: "power1.inOut" },
              0.84
            );
            heroTl.fromTo(
              p5Panels[1],
              { width: "50%" },
              { width: "20%", duration: 0.08, ease: "power1.inOut" },
              0.84
            );
            heroTl.fromTo(
              p5Panels[2],
              { width: "0%" },
              { width: "20%", duration: 0.08, ease: "power1.inOut" },
              0.84
            );
            heroTl.fromTo(
              p5Panels[3],
              { width: "50%" },
              { width: "20%", duration: 0.08, ease: "power1.inOut" },
              0.84
            );
            heroTl.fromTo(
              p5Panels[4],
              { width: "0%" },
              { width: "20%", duration: 0.08, ease: "power1.inOut" },
              0.84
            );
          }

          // 0.88–1.00: Full-frame handoff still matching p5
          // Hold full viewport, 20/20/20/20/20 still
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 02 & 03: Marketplace Single Controller (P0-01 & P0-04)
      // ---------------------------------------------------------------------
      if (marketSection) {
        const panelEls = Array.from(
          marketSection.querySelectorAll<HTMLElement>("[data-marketplace-panel-id]")
        );
        const dynamicIds = panelEls
          .map((el) => el.getAttribute("data-marketplace-panel-id")!)
          .filter(Boolean);
        const categoryIds =
          dynamicIds.length > 0
            ? dynamicIds
            : ["grocery", "fashion", "food", "home", "wellness"];

        if (window.innerWidth >= 900) {
          // Desktop: Pin duration +=105vh
          const marketTl = gsap.timeline({
            scrollTrigger: {
              trigger: marketSection,
              start: "top top",
              end: "+=105%",
              pin: true,
              scrub: 0.25,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onEnter: () => {
                setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
                setActiveActorSafe(null);
              },
              onEnterBack: () => {
                setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
                setActiveActorSafe(null);
              },
              onLeave: () => {
                // P0-01 Invariant: At onLeave, trailer takeover is ALWAYS autoAlpha: 0
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              },
              onLeaveBack: () => {
                // When scrolling reverse into Hero, takeover plane is governed by Hero progress
                if (heroTrigger && heroTrigger.progress >= 0.64) {
                  if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1 });
                } else {
                  if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
                }
              },
              onUpdate: (self) => {
                const p = self.progress;

                // Ownership model:
                // 0.00–0.10: identical p5 handoff still (takeover hidden at 0.10)
                // 0.10+: takeover hidden completely
                if (p <= 0.10) {
                  if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1 });
                } else {
                  if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
                }

                // Progression bands:
                // 0.00–0.10: handoff
                // 0.10–0.26: panel 0 (grocery)
                // 0.26–0.42: panel 1 (fashion)
                // 0.42–0.58: panel 2 (food)
                // 0.58–0.74: panel 3 (home)
                // 0.74–0.90: panel 4 (wellness)
                // 0.90–1.00: release still
                let activeIdx = 1; // default fashion
                if (p > 0.10 && p <= 0.26) activeIdx = 0;
                else if (p > 0.26 && p <= 0.42) activeIdx = 1;
                else if (p > 0.42 && p <= 0.58) activeIdx = 2;
                else if (p > 0.58 && p <= 0.74) activeIdx = 3;
                else if (p > 0.74) activeIdx = 4;

                const activeId = categoryIds[activeIdx] || "fashion";
                setMarketplaceActiveIdSafe(activeId);

                // Proportional widths: active 54%, inactive 11.5% each
                panelEls.forEach((panel, i) => {
                  const isActive = i === activeIdx;
                  gsap.set(panel, {
                    width: isActive ? "54%" : "11.5%",
                    overwrite: "auto",
                  });
                });
              },
            },
          });

          marketTrigger = marketTl.scrollTrigger ?? null;
        } else {
          // Mobile (<900px): Native touch snap corridor, no desktop pin
          ScrollTrigger.create({
            trigger: marketSection,
            start: "top 80%",
            end: "bottom 20%",
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
            onLeave: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
            },
            onLeaveBack: () => {
              if (heroTrigger && heroTrigger.progress >= 0.64) {
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1 });
              } else {
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              }
            },
          });
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 04: Perspective Image Fan (P1-05 & Amendment #3)
      // ---------------------------------------------------------------------
      if (fanSection) {
        const fanCards = Array.from(fanSection.querySelectorAll<HTMLElement>(".kt-fan-card"));
        const heroCard = fanSection.querySelector<HTMLElement>(".kt-fan-hero-card");

        // Set initial geometry via gsap.set based on data attributes (P1-05)
        fanCards.forEach((card) => {
          const rot = parseFloat(card.getAttribute("data-fan-rot") || "0");
          const xOff = parseFloat(card.getAttribute("data-fan-x") || "0");
          const yOff = parseFloat(card.getAttribute("data-fan-y") || "0");
          gsap.set(card, {
            x: xOff,
            y: yOff,
            rotation: rot,
            transformOrigin: "bottom center",
          });
        });

        // Contraction into Preparation parcel target (P1-06)
        const fanTl = gsap.timeline({
          scrollTrigger: {
            trigger: fanSection,
            start: "top 60%",
            end: "bottom 30%",
            scrub: 0.3,
            onEnter: () => {
              // Ensure trailer takeover is strictly hidden at deep scroll
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
          },
        });

        // 0.00–0.45: Fan visible in perspective spread
        // 0.45–0.70: Side cards compress behind hero
        fanCards.forEach((card) => {
          const isHero = card.getAttribute("data-is-hero") === "true";
          if (!isHero) {
            fanTl.to(
              card,
              {
                x: 0,
                y: 20,
                rotation: 0,
                scale: 0.8,
                opacity: 0,
                ease: "power2.inOut",
                duration: 0.25,
              },
              0.45
            );
          }
        });

        // 0.70–0.84: Hero alone
        if (heroCard) {
          fanTl.to(
            heroCard,
            {
              scale: 1.05,
              y: 0,
              ease: "power1.out",
              duration: 0.14,
            },
            0.7
          );

          // 0.84–0.94: Hero contracts toward parcel target
          fanTl.to(
            heroCard,
            {
              scale: 0.8,
              y: 60,
              opacity: 0.9,
              ease: "power2.in",
              duration: 0.1,
            },
            0.84
          );
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 05: Merchant Preparation & Corrugated Box (P1-06)
      // ---------------------------------------------------------------------
      if (prepSection) {
        const prepPhoto = prepSection.querySelector<HTMLElement>(".prepPhotoImg");

        ScrollTrigger.create({
          trigger: prepSection,
          start: "top 75%",
          end: "bottom 25%",
          onEnter: () => {
            if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
            setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
            setActiveActorSafe(null);
          },
          onEnterBack: () => {
            if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
            setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
            setActiveActorSafe(null);
          },
        });

        if (prepPhoto) {
          // Subtle 1-2% documentary crop drift
          gsap.fromTo(
            prepPhoto,
            { scale: 1.0 },
            {
              scale: 1.02,
              ease: "none",
              scrollTrigger: {
                trigger: prepSection,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            }
          );
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 06: Local Collection (P1-07 & Amendment #4)
      // Arrive -> Brake -> Stop -> Open Door -> Courier Load
      // ---------------------------------------------------------------------
      if (collectionSection && vanSlot) {
        const vanDoorWindow = vanSlot.querySelector<HTMLElement>("[data-van-door-window]");

        const collectTl = gsap.timeline({
          scrollTrigger: {
            trigger: collectionSection,
            start: "top 70%",
            end: "bottom 45%",
            scrub: 0.25,
            anticipatePin: 1,
            onUpdate: (self) => {
              const p = self.progress;
              // Deterministic progress-derived visibility (P1-07):
              // At enter: van only. Around 0.68: courier appears.
              if (p < 0.68) {
                setActorVisibilitySafe({ whiteTruck: false, van: true, courier: false, redTruck: false });
                setActiveActorSafe("van");
              } else {
                setActorVisibilitySafe({ whiteTruck: false, van: true, courier: true, redTruck: false });
                setActiveActorSafe("van");
              }

              // Courier loading pose only while partially covered under door/seam
              if (p >= 0.82) {
                setCourierStateSafe("loading-unloading");
              } else {
                setCourierStateSafe("look-right-approach");
              }
            },
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.van = collectionVanAnchor;
              currentAnchors.current.courier = collectionCourierAnchor;
              alignSlotToAnchor(vanSlot, collectionVanAnchor);
              alignSlotToAnchor(courierSlot, collectionCourierAnchor);
              setVanStateSafe("side-right");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.van = collectionVanAnchor;
              currentAnchors.current.courier = collectionCourierAnchor;
              alignSlotToAnchor(vanSlot, collectionVanAnchor);
              alignSlotToAnchor(courierSlot, collectionCourierAnchor);
              setVanStateSafe("side-right");
            },
          },
        });

        // 0.00–0.52: Van approach (x -8vw -> +8px, power2.out)
        collectTl.fromTo(
          vanSlot,
          { x: "-8vw", opacity: 0.9 },
          { x: "8px", opacity: 1, duration: 0.52, ease: "power2.out" },
          0
        );

        // 0.52–0.62: Braking overshoot / settle (+8px -> 0px, power1.out)
        collectTl.to(
          vanSlot,
          { x: "0px", duration: 0.1, ease: "power1.out" },
          0.52
        );

        // 0.62–0.72: Closed hold (van is still and closed)

        // 0.72–0.84: Door continuous aperture reveal (Amendment 4)
        if (vanDoorWindow) {
          collectTl.fromTo(
            vanDoorWindow,
            { opacity: 0, x: "8%" },
            { opacity: 1, x: "0%", duration: 0.12, ease: "power1.inOut" },
            0.72
          );
        }

        // 0.68–0.82: Courier begins appearing at door (look-right-approach)
        if (courierSlot) {
          collectTl.fromTo(
            courierSlot,
            { x: "5vw", opacity: 0 },
            { x: "0vw", opacity: 1, duration: 0.14, ease: "power2.out" },
            0.68
          );
        }

        // 0.82–0.94: Courier loads parcel into van (transfer resolves)
      }

      // ---------------------------------------------------------------------
      // Chapter 07: Custody Split Seam (P1-08) & Route Concealment (P1-09)
      // ---------------------------------------------------------------------
      if (custodySection && courierSlot) {
        const custodyLeft = custodySection.querySelector<HTMLElement>(".kt-custody-left");
        const custodyRight = custodySection.querySelector<HTMLElement>(".kt-custody-right");
        const routeConcealment = custodySection.querySelector<HTMLElement>(".kt-custody-route-concealment");

        const custodyTl = gsap.timeline({
          scrollTrigger: {
            trigger: custodySection,
            start: "top 65%",
            end: "bottom 35%",
            scrub: 0.25,
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.courier = custodyCourierAnchor;
              alignSlotToAnchor(courierSlot, custodyCourierAnchor);
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: true, redTruck: false });
              setActiveActorSafe("courier");
              setCourierStateSafe("ready-handover");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.courier = custodyCourierAnchor;
              alignSlotToAnchor(courierSlot, custodyCourierAnchor);
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: true, redTruck: false });
              setActiveActorSafe("courier");
              setCourierStateSafe("ready-handover");
            },
          },
        });

        // 0.00 -> 0.45: 72/28 -> 50/50
        if (custodyLeft && custodyRight) {
          custodyTl.fromTo(custodyLeft, { width: "72%" }, { width: "50%", duration: 0.45, ease: "none" }, 0);
          custodyTl.fromTo(custodyRight, { width: "28%" }, { width: "50%", duration: 0.45, ease: "none" }, 0);

          // 0.45–0.53: HOLD at 50/50 (courier centered, no width movement)

          // 0.53 -> 1.00: 50/50 -> 28/72
          custodyTl.to(custodyLeft, { width: "28%", duration: 0.47, ease: "none" }, 0.53);
          custodyTl.to(custodyRight, { width: "72%", duration: 0.47, ease: "none" }, 0.53);
        }

        // P1-09: During final ~18–22% (0.78–1.00):
        // Road texture enters, dark lane grows, white truck aligns while hidden, top-down state set while occluded
        if (routeConcealment) {
          custodyTl.fromTo(
            routeConcealment,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.22,
              ease: "power1.inOut",
              onStart: () => {
                // Pre-align white truck to route anchor while hidden
                currentAnchors.current.whiteTruck = routeAnchor;
                alignSlotToAnchor(whiteTruckSlot, routeAnchor);
                setWhiteTruckStateSafe("top-down-straight");
              },
            },
            0.78
          );
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 08: Route Road-World Motion (P1-10) & Route -> Freight Overlap (P1-11)
      // ---------------------------------------------------------------------
      if (routeSection && whiteTruckSlot) {
        const aerialRoad = routeSection.querySelector<HTMLElement>(".kt-aerial-road-underlay");
        const overpassShadow = routeSection.querySelector<HTMLElement>(".kt-route-overpass-shadow");
        const freightOverlap = routeSection.querySelector<HTMLElement>(".kt-route-freight-overlap");

        const routeTl = gsap.timeline({
          scrollTrigger: {
            trigger: routeSection,
            start: "top 60%",
            end: "bottom 20%",
            scrub: 0.25,
            onUpdate: (self) => {
              const p = self.progress;

              // Hide white truck after Route -> Freight overlap (p > 0.85)
              if (p < 0.85) {
                setActorVisibilitySafe({ whiteTruck: true, van: false, courier: false, redTruck: false });
                setActiveActorSafe("white-truck");
              } else {
                setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
                setActiveActorSafe(null);
              }

              // Concealed state swap while >60% occluded by overpass shadow (0.68–0.78)
              if (p >= 0.72) {
                setWhiteTruckStateSafe("top-down-turning");
              } else {
                setWhiteTruckStateSafe("top-down-straight");
              }
            },
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.whiteTruck = routeAnchor;
              alignSlotToAnchor(whiteTruckSlot, routeAnchor);
              setWhiteTruckStateSafe("top-down-straight");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.whiteTruck = routeAnchor;
              alignSlotToAnchor(whiteTruckSlot, routeAnchor);
              setWhiteTruckStateSafe("top-down-straight");
            },
          },
        });

        // Environment Road-World Movement: yPercent 10 -> -12, scale 1.03 -> 1.06
        if (aerialRoad) {
          routeTl.fromTo(
            aerialRoad,
            { yPercent: 10, scale: 1.03 },
            { yPercent: -12, scale: 1.06, duration: 1.0, ease: "none" },
            0
          );
        }

        // Truck travels along the lane: small relative distance, stable scale
        routeTl.fromTo(
          whiteTruckSlot,
          { y: "-24px" },
          { y: "0px", duration: 0.42, ease: "power1.out" },
          0
        );

        // 0.42–0.54: True Reading Hold (truck still)

        // 0.62–0.82: Overpass shadow sweeps across truck; concealed swap occurs under >60% cover
        if (overpassShadow) {
          routeTl.fromTo(
            overpassShadow,
            { opacity: 0, yPercent: -100 },
            { opacity: 0.95, yPercent: 0, duration: 0.1, ease: "power2.in" },
            0.62
          );
          routeTl.to(
            overpassShadow,
            { opacity: 0, yPercent: 100, duration: 0.1, ease: "power2.out" },
            0.72
          );
        }

        // 0.80–1.00: Route -> Freight Overlap (P1-11)
        if (freightOverlap) {
          routeTl.fromTo(
            freightOverlap,
            { opacity: 0 },
            { opacity: 1, duration: 0.2, ease: "none" },
            0.8
          );
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 09: Heavy Freight Climax (P1-12)
      // ---------------------------------------------------------------------
      if (freightSection && redTruckSlot) {
        const freightWarehouse = freightSection.querySelector<HTMLElement>(".absolute.inset-0.opacity-25");

        const freightTl = gsap.timeline({
          scrollTrigger: {
            trigger: freightSection,
            start: "top 65%",
            end: "bottom 30%",
            scrub: 0.25,
            onUpdate: (self) => {
              const p = self.progress;
              // Red truck leaves before courier appears in arrival (P1-13)
              if (p < 0.86) {
                setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: true });
                setActiveActorSafe("red-truck");
              } else {
                setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
                setActiveActorSafe(null);
              }
            },
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.redTruck = freightAnchor;
              alignSlotToAnchor(redTruckSlot, freightAnchor);
              setRedTruckStateSafe("centered-hero");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.redTruck = freightAnchor;
              alignSlotToAnchor(redTruckSlot, freightAnchor);
              setRedTruckStateSafe("centered-hero");
            },
          },
        });

        // 0.00–0.18: Red truck grounded/still; warehouse environment enters
        // 0.18–0.62: 2–3% environment dolly shift; truck nearly fixed
        if (freightWarehouse) {
          freightTl.fromTo(
            freightWarehouse,
            { scale: 1.0, y: "16px" },
            { scale: 1.03, y: "-16px", duration: 0.62, ease: "power1.out" },
            0
          );
        }

        freightTl.fromTo(
          redTruckSlot,
          { y: "16px", opacity: 0.95 },
          { y: "0px", opacity: 1, duration: 0.35, ease: "power2.out" },
          0
        );

        // 0.62–0.78: Reading hold
        // 0.78–1.00: Freight world prepares Arrival (recedes)
        freightTl.to(
          redTruckSlot,
          { opacity: 0, y: "-12px", duration: 0.14, ease: "power2.in" },
          0.86
        );
      }

      // ---------------------------------------------------------------------
      // Chapter 10: Doorstep Arrival & Physical Handoff (P1-13)
      // ---------------------------------------------------------------------
      if (arrivalSection && courierSlot) {
        gsap.timeline({
          scrollTrigger: {
            trigger: arrivalSection,
            start: "top 65%",
            end: "bottom 30%",
            scrub: 0.25,
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.courier = arrivalCourierAnchor;
              alignSlotToAnchor(courierSlot, arrivalCourierAnchor);
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: true, redTruck: false });
              setActiveActorSafe("courier");
              setCourierStateSafe("extending-handoff");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.courier = arrivalCourierAnchor;
              alignSlotToAnchor(courierSlot, arrivalCourierAnchor);
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: true, redTruck: false });
              setActiveActorSafe("courier");
              setCourierStateSafe("extending-handoff");
            },
          },
        });

        // Minimal grounded courier movement
        gsap.fromTo(
          courierSlot,
          { y: "14px", opacity: 0.9 },
          {
            y: "0px",
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: arrivalSection,
              start: "top 65%",
              end: "center center",
              scrub: 0.3,
            },
          }
        );
      }

      // ---------------------------------------------------------------------
      // Chapter 11: Finale Scene (P1-13)
      // ---------------------------------------------------------------------
      if (finaleSection) {
        ScrollTrigger.create({
          trigger: finaleSection,
          start: "top 70%",
          end: "bottom bottom",
          onEnter: () => {
            if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
            setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
            setActiveActorSafe(null);
          },
          onEnterBack: () => {
            if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
            setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
            setActiveActorSafe(null);
          },
        });
      }

      // ---------------------------------------------------------------------
      // Global Progress-Derived Resolver across the entire page (Amendment #2)
      // Reconstructs the exact visual state from current scroll position
      // ---------------------------------------------------------------------
      const resolveVisualStateFromScroll = () => {
        if (!container) return;

        // Position of sections
        const heroRect = heroSection?.getBoundingClientRect();
        const marketRect = marketSection?.getBoundingClientRect();

        // P0-01 Ownership invariant:
        // Beyond marketplace top or at deep scroll, trailerOverlay MUST be autoAlpha: 0
        if (marketTrigger && marketTrigger.progress > 0.10) {
          if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
        } else if (marketRect && marketRect.top <= 0 && marketRect.bottom <= 0) {
          // Scrolled completely past Marketplace into downstream chapters
          if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
        } else if (heroRect && heroRect.top <= 0 && heroRect.bottom > 0) {
          // Inside Hero
          if (heroTrigger) {
            const hp = heroTrigger.progress;
            if (hp < 0.64) {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
            } else {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1 });
            }
          }
        }

        updateAllAnchorPositions();
      };

      handleRefreshOrResize = () => {
        updateAllAnchorPositions();
        resolveVisualStateFromScroll();
      };

      handleRefreshInit = () => {
        // Remeasure trailer rect on refreshInit after fonts/images settle
        updateAllAnchorPositions();
      };

      updateAllAnchorPositions();
      resolveVisualStateFromScroll();

      ScrollTrigger.addEventListener("refreshInit", handleRefreshInit);
      ScrollTrigger.addEventListener("refresh", handleRefreshOrResize);
      window.addEventListener("resize", handleRefreshOrResize);
    }, rootRef);

    timelineCtxRef.current = ctx;

    return () => {
      ScrollTrigger.removeEventListener("refreshInit", handleRefreshInit);
      ScrollTrigger.removeEventListener("refresh", handleRefreshOrResize);
      window.removeEventListener("resize", handleRefreshOrResize);
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
    onActorVisibilityChange,
    onMarketplaceActiveIdChange,
  ]);
}
