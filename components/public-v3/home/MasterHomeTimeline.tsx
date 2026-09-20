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
      const p3Panels = trailerOverlay?.querySelectorAll<HTMLElement>("[data-takeover-p3-panel]");

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

      // Fixed Viewport Camera Stage
      const stage =
        container.querySelector<HTMLElement>(".kt-cinematic-actor-stage") ||
        (typeof document !== "undefined"
          ? document.querySelector<HTMLElement>(".kt-cinematic-actor-stage")
          : null);

      // Helper: Position actor slot to match anchor in fixed stage space
      const alignSlotToAnchor = (slot: HTMLElement | null, anchor: HTMLElement | null) => {
        if (!slot || !anchor) return;
        const sRect = stage ? stage.getBoundingClientRect() : { top: 0, left: 0 };
        const aRect = anchor.getBoundingClientRect();
        gsap.set(slot, {
          top: aRect.top - sRect.top,
          left: aRect.left - sRect.left,
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
      // Chapter 01: Hero Scene & Measured Material Takeover (Phase 2 & Phase 3A)
      // ---------------------------------------------------------------------
      const isMobile = window.innerWidth < 768;
      const ktWord = heroSection?.querySelector<HTMLElement>("[data-motion='hero-kt']") || heroSection?.querySelector<HTMLElement>(".heroWordKt");
      const courierWord = heroSection?.querySelector<HTMLElement>("[data-motion='hero-courier']") || heroSection?.querySelector<HTMLElement>(".heroWordCourier");
      const heroActions = heroSection?.querySelector<HTMLElement>("[data-motion='hero-actions']") || heroSection?.querySelector<HTMLElement>(".heroActionsRow");
      const heroRoadAtmosphere = heroSection?.querySelector<HTMLElement>("[data-motion='hero-road']") || heroSection?.querySelector<HTMLElement>(".kt-hero-road-atmosphere");

      let heroTrigger: ScrollTrigger | null = null;
      let marketTrigger: ScrollTrigger | null = null;

      if (heroSection && whiteTruckSlot) {
        const initialTrailerRect = getMeasuredTrailerRect();

        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: isMobile ? "+=120%" : "+=200%",
            pin: true,
            scrub: 0.2,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress;
              // Deterministic Hero/Takeover state derived strictly from progress (Item 6)
              if (p < 0.86) {
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
                setWhiteTruckStateSafe("wide-hero");
                setActorVisibilitySafe({ whiteTruck: true, van: false, courier: false, redTruck: false });
                setActiveActorSafe("white-truck");
              } else if (p >= 0.86 && p < 0.94) {
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1 });
                setWhiteTruckStateSafe("wide-hero");
                setActorVisibilitySafe({ whiteTruck: true, van: false, courier: false, redTruck: false });
                setActiveActorSafe("white-truck");
              } else {
                // p >= 0.94: White truck consumed, takeover completes into marketplace
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1 });
                setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
                setActiveActorSafe(null);
              }
            },
          },
        });

        heroTrigger = heroTl.scrollTrigger ?? null;

        // Authoritative 4-Plane Hero Motion Choreography (Directive Items 6, 7, 8, 9)
        // Motion ratios: Truck: 1.00, Road/env: 0.45 counter, COURIER: 0.18, KT: 0.08, Copy: 0 during hold
        if (!isMobile) {
          // 0.00–0.07: Brand & environment establish. Truck starts genuinely off-screen left.
          heroTl.set(
            whiteTruckSlot,
            { x: "-105vw", y: 0, scale: 1, opacity: 1 },
            0
          );
          if (heroRoadAtmosphere) {
            heroTl.set(heroRoadAtmosphere, { x: "0vw" }, 0);
          }
          if (heroActions) {
            heroTl.set(heroActions, { opacity: 1, y: 0 }, 0);
          }
          if (ktWord) {
            heroTl.set(ktWord, { x: "0vw" }, 0);
          }
          if (courierWord) {
            heroTl.set(courierWord, { x: "0vw" }, 0);
          }

          // 0.07–0.22: Truck enters left → right; environment counter-moves
          heroTl.to(
            whiteTruckSlot,
            { x: "-20vw", duration: 0.15, ease: "power2.out" },
            0.07
          );
          if (heroRoadAtmosphere) {
            heroTl.to(
              heroRoadAtmosphere,
              { x: "3.5vw", duration: 0.15, ease: "power1.out" },
              0.07
            );
          }
          if (ktWord) {
            heroTl.to(ktWord, { x: "-0.8vw", duration: 0.15, ease: "none" }, 0.07);
          }
          if (courierWord) {
            heroTl.to(courierWord, { x: "-1.8vw", duration: 0.15, ease: "none" }, 0.07);
          }

          // 0.22–0.33: Truck decelerates into Hero hold with subtle 2-4px suspension settle
          heroTl.to(
            whiteTruckSlot,
            { x: "0vw", y: "3px", duration: 0.07, ease: "power3.out" },
            0.22
          );
          heroTl.to(
            whiteTruckSlot,
            { y: "0px", duration: 0.04, ease: "power1.out" },
            0.29
          );
          if (heroRoadAtmosphere) {
            heroTl.to(
              heroRoadAtmosphere,
              { x: "5vw", duration: 0.11, ease: "power1.out" },
              0.22
            );
          }
          if (ktWord) {
            heroTl.to(ktWord, { x: "-1.2vw", duration: 0.11, ease: "none" }, 0.22);
          }
          if (courierWord) {
            heroTl.to(courierWord, { x: "-2.5vw", duration: 0.11, ease: "none" }, 0.22);
          }

          // 0.33–0.46: READING HOLD. Truck nearly still; copy & CTAs fully readable; typography settles
          heroTl.to(
            whiteTruckSlot,
            { x: "0.8vw", duration: 0.13, ease: "none" },
            0.33
          );

          // 0.46–0.55: Environment moves first; truck prepares to accelerate
          if (heroRoadAtmosphere) {
            heroTl.to(
              heroRoadAtmosphere,
              { x: "10vw", duration: 0.09, ease: "power1.in" },
              0.46
            );
          }
          heroTl.to(
            whiteTruckSlot,
            { x: "2.5vw", duration: 0.09, ease: "power1.in" },
            0.46
          );
          if (heroActions) {
            heroTl.to(heroActions, { opacity: 0.7, duration: 0.04 }, 0.50);
          }

          // 0.55–0.68: Truck accelerates right; copy clears before collision
          heroTl.to(
            whiteTruckSlot,
            { x: "45vw", duration: 0.13, ease: "power2.in" },
            0.55
          );
          if (heroActions) {
            heroTl.to(heroActions, { opacity: 0, y: 15, duration: 0.04 }, 0.55);
          }
          if (heroRoadAtmosphere) {
            heroTl.to(
              heroRoadAtmosphere,
              { x: "18vw", duration: 0.13, ease: "power2.in" },
              0.55
            );
          }
          if (ktWord) {
            heroTl.to(ktWord, { x: "-3vw", duration: 0.13, ease: "none" }, 0.55);
          }
          if (courierWord) {
            heroTl.to(courierWord, { x: "3.5vw", duration: 0.13, ease: "none" }, 0.55);
          }

          // 0.68–0.78: Cab exits; trailer remains across frame
          heroTl.to(
            whiteTruckSlot,
            { x: "65vw", duration: 0.10, ease: "power1.out" },
            0.68
          );

          // 0.78–0.86: Trailer becomes dominant foreground surface
          heroTl.to(
            whiteTruckSlot,
            { x: "80vw", duration: 0.08, ease: "power1.inOut" },
            0.78
          );
        } else {
          // Mobile authored Hero choreography (Directive Item 10)
          heroTl.set(
            whiteTruckSlot,
            { x: "-120vw", y: 0, scale: 1, opacity: 1 },
            0
          );
          if (heroActions) {
            heroTl.set(heroActions, { opacity: 1, y: 0 }, 0);
          }

          // 0.07–0.22: Truck enters from left
          heroTl.to(
            whiteTruckSlot,
            { x: "-25vw", duration: 0.15, ease: "power2.out" },
            0.07
          );

          // 0.22–0.33: Deceleration into settle
          heroTl.to(
            whiteTruckSlot,
            { x: "0vw", duration: 0.11, ease: "power3.out" },
            0.22
          );

          // 0.33–0.46: Reading hold (full silhouette visible, copy readable)
          heroTl.to(
            whiteTruckSlot,
            { x: "0.8vw", duration: 0.13, ease: "none" },
            0.33
          );

          // 0.46–0.55: Preparation to accelerate
          heroTl.to(
            whiteTruckSlot,
            { x: "2.5vw", duration: 0.09, ease: "power1.in" },
            0.46
          );
          if (heroActions) {
            heroTl.to(heroActions, { opacity: 0.7, duration: 0.04 }, 0.50);
          }

          // 0.55–0.68: Acceleration right; copy clears
          heroTl.to(
            whiteTruckSlot,
            { x: "52vw", duration: 0.13, ease: "power2.in" },
            0.55
          );
          if (heroActions) {
            heroTl.to(heroActions, { opacity: 0, y: 15, duration: 0.04 }, 0.55);
          }

          // 0.68–0.78: Cab exits; trailer remains
          heroTl.to(
            whiteTruckSlot,
            { x: "72vw", duration: 0.10, ease: "power1.out" },
            0.68
          );

          // 0.78–0.86: Trailer dominates frame
          heroTl.to(
            whiteTruckSlot,
            { x: "85vw", duration: 0.08, ease: "power1.inOut" },
            0.78
          );
        }

        // 0.86–0.94: Trailer Takeover Plane appears inside trailer bounds and expands
        if (trailerOverlay) {
          heroTl.set(
            trailerOverlay,
            {
              left: initialTrailerRect.left,
              top: initialTrailerRect.top,
              width: initialTrailerRect.width,
              height: initialTrailerRect.height,
              autoAlpha: 1,
            },
            0.86
          );

          heroTl.to(
            trailerOverlay,
            {
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              duration: 0.08,
              ease: "power2.inOut",
            },
            0.86
          );

          // Subdivide aperture into adjacent media
          if (p1Layer && p3Layer) {
            heroTl.to(p1Layer, { autoAlpha: 0, duration: 0.04 }, 0.89);
            heroTl.to(p3Layer, { autoAlpha: 1, duration: 0.04 }, 0.89);
          }

          if (p3Panels && p3Panels.length === 3) {
            heroTl.fromTo(
              p3Panels[0],
              { width: "0%" },
              { width: "33.3%", duration: 0.05, ease: "power1.inOut" },
              0.89
            );
            heroTl.fromTo(
              p3Panels[1],
              { width: "100%" },
              { width: "33.4%", duration: 0.05, ease: "power1.inOut" },
              0.89
            );
            heroTl.fromTo(
              p3Panels[2],
              { width: "0%" },
              { width: "33.3%", duration: 0.05, ease: "power1.inOut" },
              0.89
            );
          }

          // 0.94–1.00: White truck consumed; trailer takeover hands off to Marketplace
          heroTl.to(
            whiteTruckSlot,
            { opacity: 0, duration: 0.06 },
            0.94
          );
        }
      }

      // ---------------------------------------------------------------------
      // Chapter 02 & 03: Marketplace Horizontal Journey (Phase 3B)
      // ---------------------------------------------------------------------
      if (marketSection) {
        const marketRail = marketSection.querySelector<HTMLElement>("[data-motion='market-rail']");
        const marketWord = marketSection.querySelector<HTMLElement>("[data-motion='market-word']");
        const marketCards = Array.from(
          marketSection.querySelectorAll<HTMLElement>("[data-marketplace-panel-id]")
        );
        const marketCardImgs = Array.from(
          marketSection.querySelectorAll<HTMLElement>(".kt-market-card-img")
        );
        const dynamicIds = marketCards
          .map((el) => el.getAttribute("data-marketplace-panel-id")!)
          .filter(Boolean);
        const categoryIds =
          dynamicIds.length > 0
            ? dynamicIds
            : ["grocery", "fashion", "food", "home", "wellness"];
        const categoryWords = ["FRESH", "FASHION", "FOOD", "CRAFT", "CARE"];

        if (window.innerWidth >= 900 && marketRail) {
          const marketTl = gsap.timeline({
            scrollTrigger: {
              trigger: marketSection,
              start: "top top",
              end: () =>
                `+=${Math.max(
                  window.innerHeight * 1.6,
                  marketRail.scrollWidth - window.innerWidth + window.innerWidth * 0.08
                )}`,
              pin: true,
              scrub: 0.2,
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
                // Strict Phase 3A/3B Invariant: trailer takeover is ALWAYS autoAlpha: 0 once past Marketplace
                if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0, visibility: "hidden" });
              },
              onLeaveBack: () => {
                // When scrolling reverse into Hero, takeover plane is governed by Hero progress
                if (heroTrigger && heroTrigger.progress >= 0.84) {
                  if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1, visibility: "visible" });
                } else {
                  if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0, visibility: "hidden" });
                }
              },
              onUpdate: (self) => {
                const p = self.progress;

                // Ownership model:
                // 0.00–0.06: takeover plane visible for seamless handoff; thereafter strictly autoAlpha: 0
                if (p <= 0.06) {
                  if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 1 });
                } else {
                  if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
                }

                // Active category calculation
                const activeIdx = Math.min(
                  categoryIds.length - 1,
                  Math.max(0, Math.floor(p * categoryIds.length))
                );
                const activeId = categoryIds[activeIdx] || "grocery";
                const activeWord = categoryWords[activeIdx] || "FRESH";

                setMarketplaceActiveIdSafe(activeId);

                if (marketWord && marketWord.textContent !== activeWord) {
                  marketWord.textContent = activeWord;
                }

                marketCards.forEach((card, i) => {
                  card.setAttribute("data-marketplace-active", i === activeIdx ? "true" : "false");
                });
              },
            },
          });

          // Lateral rail scrub: measured dynamically
          marketTl.to(
            marketRail,
            {
              x: () => -(marketRail.scrollWidth - window.innerWidth + window.innerWidth * 0.06),
              duration: 1.0,
              ease: "none",
            },
            0
          );

          // Giant active category word counter-parallax (moves slower than rail)
          if (marketWord) {
            marketTl.fromTo(
              marketWord,
              { x: "4vw" },
              { x: "-8vw", duration: 1.0, ease: "none" },
              0
            );
          }

          // Active image crop shift (2-4%)
          marketCardImgs.forEach((img) => {
            marketTl.fromTo(
              img,
              { xPercent: -2 },
              { xPercent: 2, duration: 1.0, ease: "none" },
              0
            );
          });

          marketTrigger = marketTl.scrollTrigger ?? null;
        } else {
          // Mobile (<900px): Native touch snap corridor, no desktop GSAP x transform
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
              if (heroTrigger && heroTrigger.progress >= 0.84) {
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
      // Chapter 06: Local Collection (Phase 4B & 4C)
      // Arrive -> Brake -> Settle -> Open Door -> Courier Load
      // ---------------------------------------------------------------------
      if (collectionSection && vanSlot) {
        const vanInterior = vanSlot.querySelector<HTMLElement>("[data-van-interior-reveal]");
        const vanDoorPanel = vanSlot.querySelector<HTMLElement>("[data-van-door-panel]");
        const vanDoorWindow = vanSlot.querySelector<HTMLElement>("[data-van-door-window]");
        const streetEnv = collectionSection.querySelector<HTMLElement>(".kt-collection-street-env");

        const collectTl = gsap.timeline({
          scrollTrigger: {
            trigger: collectionSection,
            start: "top top",
            end: isMobile ? "+=130%" : "+=170%",
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress;

              // Van state transition family: motion-transition (#13) -> side-left (#02) -> sliding-door-open (#10)
              if (p < 0.38) {
                setVanStateSafe("motion-transition");
                setActorVisibilitySafe({ whiteTruck: false, van: true, courier: false, redTruck: false });
                setActiveActorSafe("van");
              } else if (p >= 0.38 && p < 0.70) {
                setVanStateSafe("side-left");
                setActorVisibilitySafe({ whiteTruck: false, van: true, courier: false, redTruck: false });
                setActiveActorSafe("van");
              } else {
                setVanStateSafe("sliding-door-open");
                // Door open -> courier visible near opening
                const showCourier = p >= 0.76;
                setActorVisibilitySafe({ whiteTruck: false, van: true, courier: showCourier, redTruck: false });
                setActiveActorSafe("van");

                if (p >= 0.84) {
                  setCourierStateSafe("loading-unloading");
                } else if (showCourier) {
                  setCourierStateSafe("look-left-approach");
                }
              }
            },
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.van = collectionVanAnchor;
              currentAnchors.current.courier = collectionCourierAnchor;
              alignSlotToAnchor(vanSlot, collectionVanAnchor);
              alignSlotToAnchor(courierSlot, collectionCourierAnchor);
              setVanStateSafe("motion-transition");
              setActorVisibilitySafe({ whiteTruck: false, van: true, courier: false, redTruck: false });
              setActiveActorSafe("van");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.van = collectionVanAnchor;
              currentAnchors.current.courier = collectionCourierAnchor;
              alignSlotToAnchor(vanSlot, collectionVanAnchor);
              alignSlotToAnchor(courierSlot, collectionCourierAnchor);
              setVanStateSafe("sliding-door-open");
              setActorVisibilitySafe({ whiteTruck: false, van: true, courier: true, redTruck: false });
              setActiveActorSafe("van");
            },
            onLeave: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
            onLeaveBack: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
          },
        });

        // 0.00–0.46: Van approach (x -42vw -> 5vw, power2.out)
        collectTl.fromTo(
          vanSlot,
          { x: "-42vw", opacity: 0.9 },
          { x: "5vw", opacity: 1, duration: 0.46, ease: "power2.out" },
          0
        );

        // Environmental counter-movement (rate 0.4)
        if (streetEnv) {
          collectTl.fromTo(
            streetEnv,
            { x: "0vw" },
            { x: "3.5vw", duration: 0.56, ease: "power1.out" },
            0
          );
        }

        // 0.46–0.56: Braking deceleration (settles 4px back, 5vw -> calc(5vw - 4px))
        collectTl.to(
          vanSlot,
          { x: "calc(5vw - 4px)", duration: 0.10, ease: "power1.out" },
          0.46
        );

        // 0.56–0.62: Subtle suspension settle
        collectTl.to(
          vanSlot,
          { y: "3px", duration: 0.03, ease: "power1.in" },
          0.56
        );
        collectTl.to(
          vanSlot,
          { y: "0px", duration: 0.03, ease: "power1.out" },
          0.59
        );

        // 0.62–0.70: Closed Van hold

        // 0.70–0.84: Mechanical sliding door physical event
        // Door travels rearward inside travel envelope while cargo aperture reveals interior
        if (vanInterior) {
          collectTl.fromTo(
            vanInterior,
            { opacity: 0 },
            { opacity: 1, duration: 0.14, ease: "power1.inOut" },
            0.70
          );
        }
        if (vanDoorPanel) {
          collectTl.fromTo(
            vanDoorPanel,
            { opacity: 0, x: "0%" },
            { opacity: 1, x: "16%", duration: 0.14, ease: "power1.inOut" },
            0.70
          );
        } else if (vanDoorWindow) {
          collectTl.fromTo(
            vanDoorWindow,
            { opacity: 0, x: "12%" },
            { opacity: 1, x: "0%", duration: 0.14, ease: "power1.inOut" },
            0.70
          );
        }

        // 0.76–0.86: Courier becomes visible once door travels rearward
        if (courierSlot) {
          collectTl.fromTo(
            courierSlot,
            { x: "6vw", opacity: 0 },
            { x: "0vw", opacity: 1, duration: 0.10, ease: "power2.out" },
            0.76
          );
        }

        // 0.84–1.00: Courier loads parcel into van (transfer completes)
      }

      // ---------------------------------------------------------------------
      // Chapter 07: Custody Split Seam (P1-08) & Route Concealment (P1-09)
      // ---------------------------------------------------------------------
      if (custodySection && courierSlot) {
        const custodyLeft = custodySection.querySelector<HTMLElement>(".kt-custody-left");
        const custodyRight = custodySection.querySelector<HTMLElement>(".kt-custody-right");
        const custodyMerchantImg = custodySection.querySelector<HTMLElement>(".kt-custody-merchant-img");
        const custodyCourierImg = custodySection.querySelector<HTMLElement>(".kt-custody-courier-img");
        const routeConcealment = custodySection.querySelector<HTMLElement>(".kt-custody-route-concealment");

        const custodyTl = gsap.timeline({
          scrollTrigger: {
            trigger: custodySection,
            start: "top top",
            end: isMobile ? "+=110%" : "+=140%",
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.courier = custodyCourierAnchor;
              alignSlotToAnchor(courierSlot, custodyCourierAnchor);
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: true, redTruck: false });
              setActiveActorSafe("courier");
              setCourierStateSafe("loading-unloading");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.courier = custodyCourierAnchor;
              alignSlotToAnchor(courierSlot, custodyCourierAnchor);
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: true, redTruck: false });
              setActiveActorSafe("courier");
              setCourierStateSafe("ready-handover");
            },
            onLeave: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
            onLeaveBack: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
            onUpdate: (self) => {
              const p = self.progress;
              if (p < 0.50) {
                setCourierStateSafe("loading-unloading");
              } else {
                setCourierStateSafe("ready-handover");
              }
            },
          },
        });

        // 0.00 -> 0.45: 72/28 -> 50/50 with opposing photographic crop drift
        if (custodyLeft && custodyRight) {
          custodyTl.fromTo(custodyLeft, { width: "72%" }, { width: "50%", duration: 0.45, ease: "none" }, 0);
          custodyTl.fromTo(custodyRight, { width: "28%" }, { width: "50%", duration: 0.45, ease: "none" }, 0);

          if (custodyMerchantImg) {
            custodyTl.fromTo(custodyMerchantImg, { xPercent: -2, scale: 1.0 }, { xPercent: 3, scale: 1.03, duration: 0.45, ease: "none" }, 0);
          }
          if (custodyCourierImg) {
            custodyTl.fromTo(custodyCourierImg, { xPercent: 2, scale: 1.0 }, { xPercent: -3, scale: 1.03, duration: 0.45, ease: "none" }, 0);
          }

          // 0.45–0.53: HOLD at 50/50 (courier centered, no width movement, physical responsibility pause)

          // 0.53 -> 1.00: 50/50 -> 28/72 with continued opposing crop drift
          custodyTl.to(custodyLeft, { width: "28%", duration: 0.47, ease: "none" }, 0.53);
          custodyTl.to(custodyRight, { width: "72%", duration: 0.47, ease: "none" }, 0.53);

          if (custodyMerchantImg) {
            custodyTl.to(custodyMerchantImg, { xPercent: 6, scale: 1.05, duration: 0.47, ease: "none" }, 0.53);
          }
          if (custodyCourierImg) {
            custodyTl.to(custodyCourierImg, { xPercent: -6, scale: 1.05, duration: 0.47, ease: "none" }, 0.53);
          }
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
      // Chapter 08: Route Road-World Motion (Phase 5A) & Route -> Freight Overlap (Phase 5B)
      // ---------------------------------------------------------------------
      if (routeSection && whiteTruckSlot) {
        const aerialRoad = routeSection.querySelector<HTMLElement>(".kt-aerial-road-underlay");
        const overpassShadow = routeSection.querySelector<HTMLElement>(".kt-route-overpass-shadow");
        const freightOverlap = routeSection.querySelector<HTMLElement>(".kt-route-freight-overlap");

        const routeTl = gsap.timeline({
          scrollTrigger: {
            trigger: routeSection,
            start: "top top",
            end: isMobile ? "+=120%" : "+=150%",
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
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

              // Authored Route sequence: 08 straight -> 09 angled -> 16 turning
              if (p < 0.48) {
                setWhiteTruckStateSafe("top-down-straight");
              } else if (p >= 0.48 && p < 0.68) {
                setWhiteTruckStateSafe("top-down-angled");
              } else {
                setWhiteTruckStateSafe("top-down-turning");
              }
            },
            onEnter: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.whiteTruck = routeAnchor;
              alignSlotToAnchor(whiteTruckSlot, routeAnchor);
              setWhiteTruckStateSafe("top-down-straight");
              setActorVisibilitySafe({ whiteTruck: true, van: false, courier: false, redTruck: false });
              setActiveActorSafe("white-truck");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.whiteTruck = routeAnchor;
              alignSlotToAnchor(whiteTruckSlot, routeAnchor);
              setWhiteTruckStateSafe("top-down-turning");
              setActorVisibilitySafe({ whiteTruck: true, van: false, courier: false, redTruck: false });
              setActiveActorSafe("white-truck");
            },
            onLeave: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
            onLeaveBack: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
          },
        });

        // Environment Road-World Movement: rate 1.0 (yPercent 12 -> -14, scale 1.03 -> 1.07)
        if (aerialRoad) {
          routeTl.fromTo(
            aerialRoad,
            { yPercent: 12, scale: 1.03 },
            { yPercent: -14, scale: 1.07, duration: 1.0, ease: "none" },
            0
          );
        }

        // Truck travels along the lane: rate ~0.60
        routeTl.fromTo(
          whiteTruckSlot,
          { y: "-30px" },
          { y: "6px", duration: 0.42, ease: "power1.out" },
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
      // Chapter 09: Heavy Freight Climax (Phase 5C)
      // ---------------------------------------------------------------------
      if (freightSection && redTruckSlot) {
        const freightWarehouse = freightSection.querySelector<HTMLElement>(".kt-freight-warehouse-env");
        const freightType = freightSection.querySelector<HTMLElement>("[data-motion='freight-type']");

        const freightTl = gsap.timeline({
          scrollTrigger: {
            trigger: freightSection,
            start: "top top",
            end: isMobile ? "+=110%" : "+=140%",
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress;
              // Red truck leaves before courier appears in arrival (P1-13)
              if (p < 0.25) {
                setRedTruckStateSafe("motion-entry");
                setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: true });
                setActiveActorSafe("red-truck");
              } else if (p >= 0.25 && p < 0.86) {
                setRedTruckStateSafe("centered-hero");
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
              setRedTruckStateSafe("motion-entry");
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: true });
              setActiveActorSafe("red-truck");
            },
            onEnterBack: () => {
              if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0 });
              currentAnchors.current.redTruck = freightAnchor;
              alignSlotToAnchor(redTruckSlot, freightAnchor);
              setRedTruckStateSafe("centered-hero");
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: true });
              setActiveActorSafe("red-truck");
            },
            onLeave: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
            onLeaveBack: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
          },
        });

        // 0.00–0.18: Red truck grounded/still; warehouse environment enters
        // 0.18–0.62: 2–3% environment dolly shift (1.035); truck nearly fixed
        if (freightWarehouse) {
          freightTl.fromTo(
            freightWarehouse,
            { scale: 1.0, y: "20px" },
            { scale: 1.035, y: "-20px", duration: 0.62, ease: "power1.out" },
            0
          );
        }

        if (freightType) {
          freightTl.fromTo(
            freightType,
            { x: "4vw", opacity: 0.04 },
            { x: "-4vw", opacity: 0.08, duration: 1.0, ease: "none" },
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
      // Chapter 10: Doorstep Arrival & Physical Handoff (Phase 5D)
      // ---------------------------------------------------------------------
      if (arrivalSection && courierSlot) {
        gsap.timeline({
          scrollTrigger: {
            trigger: arrivalSection,
            start: "top top",
            end: isMobile ? "+=80%" : "+=110%",
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
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
            onLeave: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
            },
            onLeaveBack: () => {
              setActorVisibilitySafe({ whiteTruck: false, van: false, courier: false, redTruck: false });
              setActiveActorSafe(null);
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
              start: "top top",
              end: "center center",
              scrub: 0.3,
            },
          }
        );
      }

      // ---------------------------------------------------------------------
      // Chapter 11: Finale Scene (Single Brand Horizon Payoff — Phase 5E)
      // ---------------------------------------------------------------------
      if (finaleSection) {
        const finaleKt = finaleSection.querySelector<HTMLElement>("[data-motion='finale-kt']");
        const finaleCourier = finaleSection.querySelector<HTMLElement>("[data-motion='finale-courier']");
        const finaleGroundStrip = finaleSection.querySelector<HTMLElement>("[data-motion='finale-road']");

        const finaleTl = gsap.timeline({
          scrollTrigger: {
            trigger: finaleSection,
            start: "top 75%",
            end: "bottom bottom",
            scrub: 0.25,
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
          },
        });

        // Monumental type horizon rise at differing depth: KT rises, COURIER follows
        if (finaleKt) {
          finaleTl.fromTo(
            finaleKt,
            { y: "10vh", opacity: 0.7 },
            { y: "0vh", opacity: 1, duration: 0.5, ease: "power2.out" },
            0
          );
        }

        if (finaleCourier) {
          finaleTl.fromTo(
            finaleCourier,
            { y: "14vh", opacity: 0.6 },
            { y: "0vh", opacity: 0.95, duration: 0.6, ease: "power2.out" },
            0.08
          );
        }

        if (finaleGroundStrip) {
          // Ground corridor strip travels horizontally
          finaleTl.fromTo(
            finaleGroundStrip,
            { x: "-6vw" },
            { x: "0vw", duration: 0.8, ease: "power1.out" },
            0
          );
        }
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

        // Beyond marketplace top or at deep scroll, trailerOverlay MUST be autoAlpha: 0
        if (marketTrigger && marketTrigger.progress > 0.06) {
          if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0, visibility: "hidden" });
        } else if (marketRect && marketRect.top <= 0 && marketRect.bottom <= 0) {
          // Scrolled completely past Marketplace into downstream chapters
          if (trailerOverlay) gsap.set(trailerOverlay, { autoAlpha: 0, visibility: "hidden" });
        } else if (heroRect && heroRect.top <= 0 && heroRect.bottom > 0) {
          // Inside Hero
          if (heroTrigger) {
            const hp = heroTrigger.progress;
            if (hp < 0.84) {
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
