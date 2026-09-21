"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionContext } from "../../motion/PublicMotionProvider";
import {
  HERO_TRUCK_SEQUENCE,
  WHITE_TRUCK_STATES,
} from "../../actors/actor-state-machine";
import type { MarketplaceCategoryItem } from "../scenes/MarketplaceFivePanelScene";
import { alignGroundContact } from "./home-grounding";
import { closestReadyHeroSequenceState, isActorImageReady } from "./home-actor-image-readiness";
import { deriveHeroActorPresentation } from "./hero-actor-presentation";
import { clamp01, HOME_BEATS, range } from "./home-beats";
import { HOME_CHAPTERS, HOME_MOBILE_POLICY, type HomeChapter, type PostHeroChapter } from "./home-chapters";
import { marketplaceTrackX } from "./home-marketplace-geometry";
import { resolveHeroTruckFrame, routeTruckRotationForTangent } from "./home-frame-resolver";
import { resolveMarketplaceFrame, resolvePostHeroFrame, type PostHeroActorPose, type PostHeroFrame } from "./post-hero-frame-resolver";
import {
  isPostHeroActorReady,
  POST_HERO_ACTOR_ASSETS,
  markPostHeroActorReady,
  preloadPostHeroActorsForChapter,
} from "../actors/post-hero-actor-preload";
import { resolvePostHeroActorLifecycle } from "../actors/post-hero-cinematic-runtime";
import type { PostHeroActorKey, PostHeroActorName } from "./post-hero-frame-resolver";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

type SceneRange = {
  chapter: HomeChapter;
  section: HTMLElement;
  start: number;
  end: number;
  progressEnd: number;
};

type HeroTruckPresentation = {
  displayedState: string;
  requestedReady: boolean;
  imageReady: boolean;
  visible: boolean;
  blend: number;
  width: number;
  height: number;
  slotOpacity: number;
};

function chapterFromSection(section: HTMLElement): HomeChapter | null {
  const name = section.dataset.ktScene as HomeChapter | undefined;
  return name && HOME_CHAPTERS.includes(name) ? name : null;
}

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function styleOpacity(element: HTMLElement | null, opacity: number, vars: gsap.TweenVars = {}): void {
  if (element) gsap.set(element, { autoAlpha: clamp01(opacity), ...vars });
}

function homeHeaderTone(chapter: HomeChapter, progress: number): "light" | "dark" {
  if (chapter === "marketplace" || chapter === "freight" || chapter === "finale") return "dark";
  if (chapter === "journey" && progress >= HOME_BEATS.journey.roadGrow[0]) return "dark";
  return "light";
}

export function useHomeNarrativeDirector({
  rootRef,
  categories,
  enabled,
  onMarketplaceSelectionChange,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  categories: readonly MarketplaceCategoryItem[];
  enabled: boolean;
  onMarketplaceSelectionChange?: (id: string) => void;
}): void {
  const { prefersReducedMotion, setHeaderTone } = useMotionContext();

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const actorStage = root.querySelector<HTMLElement>("[data-kt-actor-stage]");
    const heroSlot = actorStage?.querySelector<HTMLElement>("[data-actor-slot='white-truck']") ?? null;
    const heroLayers = new Map<string, HTMLImageElement>();
    heroSlot?.querySelectorAll<HTMLImageElement>("[data-actor-state-layer]").forEach((image) => {
      const id = image.dataset.actorStateLayer;
      if (id) heroLayers.set(id, image);
      gsap.set(image, { opacity: 0, visibility: "visible" });
    });
    if (actorStage) {
      gsap.set(actorStage, { opacity: 1, visibility: "visible" });
      actorStage.querySelectorAll<HTMLElement>("[data-actor-slot]:not([data-actor-slot='white-truck'])").forEach((slot) => {
        gsap.set(slot, { opacity: 0, visibility: "hidden" });
      });
    }
    if (heroSlot) gsap.set(heroSlot, { opacity: 0, visibility: "visible" });

    const chapterScenes = Array.from(root.querySelectorAll<HTMLElement>("[data-kt-scene]"))
      .map((section) => ({ section, chapter: chapterFromSection(section) }))
      .filter((entry): entry is { section: HTMLElement; chapter: HomeChapter } => entry.chapter !== null)
      .sort((a, b) => HOME_CHAPTERS.indexOf(a.chapter) - HOME_CHAPTERS.indexOf(b.chapter));

    const postHeroStage = root.querySelector<HTMLElement>("[data-posthero-cinematic-layer]");
    const postHeroSlots = new Map<PostHeroActorName, HTMLElement>();
    const postHeroLayers = new Map<PostHeroActorKey, HTMLImageElement>();
    postHeroStage?.querySelectorAll<HTMLElement>("[data-posthero-actor-slot]").forEach((slot) => {
      const actor = slot.dataset.postheroActorSlot as PostHeroActorName | undefined;
      if (actor) postHeroSlots.set(actor, slot);
      slot.querySelectorAll<HTMLImageElement>("[data-posthero-actor-state]").forEach((image) => {
        const state = image.dataset.postheroActorState as PostHeroActorKey | undefined;
        if (state) {
          postHeroLayers.set(state, image);
          if (image.complete && image.naturalWidth > 0) markPostHeroActorReady(state);
        }
        gsap.set(image, { opacity: 0, visibility: "visible" });
      });
      gsap.set(slot, { opacity: 0, visibility: "hidden" });
    });
    if (postHeroStage) gsap.set(postHeroStage, { opacity: 0, visibility: "hidden" });
    void preloadPostHeroActorsForChapter("journey");

    const marketplaceSection = root.querySelector<HTMLElement>("[data-kt-scene='marketplace']");
    const marketRailWrapper = root.querySelector<HTMLElement>("[data-marketplace-rail-wrapper]");
    const marketRail = root.querySelector<HTMLElement>("[data-motion='market-rail']");
    const marketCards = Array.from(root.querySelectorAll<HTMLElement>("[data-marketplace-panel-id]"));
    const marketExitSlices = Array.from(root.querySelectorAll<HTMLElement>("[data-marketplace-exit-slice]"));
    const marketExitLayer = root.querySelector<HTMLElement>("[data-marketplace-exit-slices]");
    const prepPhoto = root.querySelector<HTMLElement>("[data-preparation-target]");
    const prepStreet = root.querySelector<HTMLElement>("[data-preparation-street]");
    const journeyRoad = root.querySelector<HTMLElement>("[data-journey-road]");
    const routePath = root.querySelector<SVGPathElement>("[data-route-path]");
    const custodyPanel = root.querySelector<HTMLElement>("[data-journey-custody]");
    const routeAnnotation = root.querySelector<HTMLElement>("[data-journey-route-annotation]");
    const freightServices = root.querySelector<HTMLElement>("[data-motion='freight-services']");
    const freightDestination = root.querySelector<HTMLElement>("[data-freight-destination]");
    const finaleArrival = root.querySelector<HTMLElement>("[data-finale-arrival]");
    const finaleBrandHorizon = root.querySelector<HTMLElement>("[data-finale-brand-horizon]");
    const finaleTitle = root.querySelector<HTMLElement>("[data-motion='finale-title']");
    const finaleUtility = root.querySelector<HTMLElement>("[data-motion='finale-utility']");
    const finaleLegal = root.querySelector<HTMLElement>("[data-motion='finale-legal']");
    const finaleDelivered = root.querySelector<HTMLElement>("[data-finale-delivered]");
    const heroActions = root.querySelector<HTMLElement>("[data-motion='hero-actions']");
    const heroKt = root.querySelector<HTMLElement>("[data-motion='hero-kt']");
    const heroCourier = root.querySelector<HTMLElement>("[data-motion='hero-courier']");
    const heroRoad = root.querySelector<HTMLElement>("[data-motion='hero-road']");
    const debugPanel = root.querySelector<HTMLElement>("[data-kt-motion-debug]");
    const debugGeometry = root.querySelector<HTMLElement>("[data-kt-motion-debug-geometry]");
    const debugEnabled = process.env.NODE_ENV !== "production"
      && new URLSearchParams(window.location.search).get("ktMotionDebug") === "1";
    if (debugPanel) debugPanel.hidden = !debugEnabled;
    if (debugGeometry) debugGeometry.hidden = !debugEnabled;
    root.dataset.ktMotionDebug = String(debugEnabled);

    const categoryIds = categories.map(({ id }) => id);
    const sceneRanges: SceneRange[] = [];
    const marketCardCenters: number[] = [];
    let activeSelectionId: string | null = null;
    let marketplaceManualSelectionId: string | null = null;
    let frozenExitSelectionId: string | null = null;
    let lastTone: "light" | "dark" | null = null;
    let latestChapter: HomeChapter = "hero";
    let latestProgress = 0;
    let nativeMarketplace = prefersReducedMotion || window.matchMedia("(max-width: 899px)").matches;
    let scrollFrame = 0;
    let resizeTimer = 0;
    let heroUsableActorHeight = window.innerHeight;
    let stageTop = 0;
    let stageWidth = window.innerWidth;
    let routePathLength = 0;
    let routeViewBox = { width: 1000, height: 800 };
    let marketplaceKeyboardLock = false;
    let freightPackStarted = false;

    const requestHeroImageDecode = (image?: HTMLImageElement, priority: "high" | "auto" = "auto") => {
      if (!image) return;
      image.fetchPriority = priority;
      if (isActorImageReady(image)) return;
      image.loading = "eager";
      if (typeof image.decode === "function") {
        try {
          void image.decode().catch(() => undefined);
        } catch {
          // The load handler on CinematicActorStage marks the fallback path.
        }
      }
    };

    const setMarketplaceSelection = (id: string | null) => {
      if (!id || !categoryIds.includes(id) || activeSelectionId === id) return;
      activeSelectionId = id;
      root.dataset.selectedMarketplaceId = id;
      root.dataset.homeSelectedMarketplaceId = id;
      onMarketplaceSelectionChange?.(id);
    };

    const setMarketplaceActive = (index: number) => {
      const bounded = Math.max(0, Math.min(marketCards.length - 1, index));
      marketCards.forEach((card, cardIndex) => {
        const active = cardIndex === bounded;
        card.dataset.marketplaceActive = String(active);
        card.dataset.marketplaceDistance = String(Math.abs(cardIndex - bounded));
        card.setAttribute("aria-current", active ? "true" : "false");
      });
      const category = categories[bounded];
      if (category) setMarketplaceSelection(category.id);
    };

    const onMarketplaceUserSelection = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id || !categoryIds.includes(id)) return;
      marketplaceManualSelectionId = id;
      activeSelectionId = id;
      setMarketplaceSelection(id);
    };

    const syncNativeMarketplace = () => {
      if (!nativeMarketplace || !marketRailWrapper || !marketCards.length || frozenExitSelectionId) return;
      const center = marketRailWrapper.scrollLeft + marketRailWrapper.clientWidth / 2;
      const nearest = marketCards.reduce((best, card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const bestCenter = marketCards[best]!.offsetLeft + marketCards[best]!.offsetWidth / 2;
        return Math.abs(cardCenter - center) < Math.abs(bestCenter - center) ? index : best;
      }, 0);
      setMarketplaceActive(nearest);
      marketplaceManualSelectionId = categories[nearest]?.id ?? null;
    };

    const applyHeroActor = (progress: number): HeroTruckPresentation | null => {
      const slot = heroSlot;
      if (!slot) return null;
      const frame = resolveHeroTruckFrame(progress, window.innerWidth <= 767 ? "mobile" : "desktop");
      const requestedState = frame.state;
      const requestedLayer = heroLayers.get(requestedState);
      const nextLayer = frame.blendToState ? heroLayers.get(frame.blendToState) : undefined;
      const requestedIndex = HERO_TRUCK_SEQUENCE.indexOf(requestedState as (typeof HERO_TRUCK_SEQUENCE)[number]);
      requestHeroImageDecode(requestedLayer, requestedIndex >= 0 && requestedIndex < 6 ? "high" : "auto");
      if (frame.stateBlend && frame.stateBlend > 0) requestHeroImageDecode(nextLayer);

      const requestedReady = isActorImageReady(requestedLayer);
      let displayedState = requestedState;
      if (!requestedReady) {
        const ready = new Set(Array.from(heroLayers.entries()).filter(([, layer]) => isActorImageReady(layer)).map(([state]) => state));
        const fallback = closestReadyHeroSequenceState(requestedState, ready);
        if (!fallback) {
          requestHeroImageDecode(heroLayers.get(HERO_TRUCK_SEQUENCE[0]), "high");
          heroLayers.forEach((layer) => gsap.set(layer, { opacity: 0, visibility: "visible" }));
          gsap.set(slot, { opacity: 0, visibility: "visible" });
          return {
            displayedState: requestedState,
            requestedReady: false,
            imageReady: false,
            visible: false,
            blend: 0,
            width: 0,
            height: 0,
            slotOpacity: 0,
          };
        }
        displayedState = fallback;
      }

      const definition = WHITE_TRUCK_STATES[displayedState as keyof typeof WHITE_TRUCK_STATES];
      const activeLayer = heroLayers.get(displayedState);
      const canBlend = requestedReady
        && displayedState === requestedState
        && Boolean(nextLayer && frame.stateBlend && frame.stateBlend > 0 && isActorImageReady(nextLayer));
      const blend = canBlend ? frame.stateBlend ?? 0 : 0;
      heroLayers.forEach((layer, state) => {
        const alpha = state === displayedState ? 1 - blend : canBlend && state === frame.blendToState ? blend : 0;
        gsap.set(layer, { opacity: alpha, visibility: "visible" });
      });

      const mobileHero = window.innerWidth <= 767;
      const sizingHeight = mobileHero ? heroUsableActorHeight : window.innerHeight;
      const targetWidthBase = mobileHero ? stageWidth : window.innerWidth;
      const visibleHeight = sizingHeight * (frame.sizeMode?.mode === "visible-height" ? frame.sizeMode.visibleHeightVh : 0) / 100;
      const height = visibleHeight / Math.max(0.01, definition.visibleBounds.height);
      const width = height * definition.aspectRatio;
      const aligned = alignGroundContact({
        width,
        height,
        groundContact: definition.groundContact,
        target: {
          x: targetWidthBase * frame.targetX,
          y: mobileHero ? heroUsableActorHeight * frame.groundY : window.innerHeight * frame.groundY - stageTop,
        },
      });
      const presentation = deriveHeroActorPresentation({ actorVisible: frame.visible, imageReady: isActorImageReady(activeLayer), width, height });
      gsap.set(slot, {
        x: aligned.left,
        y: aligned.top,
        width,
        height,
        rotation: frame.rotation,
        scale: frame.scale,
        transformOrigin: "0 0",
        opacity: presentation.opacity,
        visibility: presentation.visibility,
      });

      return {
        displayedState,
        requestedReady,
        imageReady: isActorImageReady(activeLayer),
        visible: presentation.isVisible,
        blend,
        width,
        height,
        slotOpacity: presentation.opacity,
      };
    };

    const actorReady = (key: PostHeroActorKey, image: HTMLImageElement | undefined) =>
      isPostHeroActorReady(key) || Boolean(image?.complete && image.naturalWidth > 0);

    const placePersistentActor = (actor: PostHeroActorName, pose: PostHeroActorPose) => {
      const slot = postHeroSlots.get(actor);
      if (!slot) return;
      const previousDisplayed = slot.dataset.postheroDisplayedState as PostHeroActorKey | undefined;
      const previousRequested = slot.dataset.postheroRequestedState as PostHeroActorKey | undefined;
      const previous = previousRequested
        ? {
            requestedState: previousRequested,
            displayedState: previousDisplayed || null,
            pendingState: (slot.dataset.postheroPendingState as PostHeroActorKey | "") || null,
            visible: slot.dataset.postheroVisible === "true",
          }
        : undefined;
      const requestedLayer = postHeroLayers.get(pose.state);
      const lifecycle = resolvePostHeroActorLifecycle({
        requestedState: pose.state,
        requestedReady: actorReady(pose.state, requestedLayer),
        previous,
        visible: pose.visible,
      });
      const layer = postHeroLayers.get(lifecycle.displayedState);
      const definition = POST_HERO_ACTOR_ASSETS[lifecycle.displayedState];

      slot.dataset.postheroExpectedActor = actor;
      slot.dataset.postheroRequestedState = lifecycle.requestedState;
      slot.dataset.postheroDisplayedState = lifecycle.displayedState;
      slot.dataset.postheroPendingState = lifecycle.pendingState ?? "";
      slot.dataset.postheroStateReady = String(lifecycle.stateReady);
      slot.dataset.postheroVisible = String(lifecycle.visible);

      slot.querySelectorAll<HTMLImageElement>("[data-posthero-actor-state]").forEach((image) => {
        const state = image.dataset.postheroActorState as PostHeroActorKey;
        const ready = actorReady(state, image);
        image.dataset.postheroActorStatus = ready ? "ready" : "loading";
        gsap.set(image, { opacity: image === layer ? 1 : 0, visibility: "visible" });
      });

      if (!lifecycle.visible) {
        slot.dataset.postheroSlotOpacity = "0";
        gsap.set(slot, { opacity: 0, visibility: "hidden" });
        return;
      }

      const displayWidth = window.innerWidth * pose.widthVw / 100;
      const displayHeight = displayWidth / Math.max(0.01, definition.aspectRatio);
      const aligned = alignGroundContact({
        width: displayWidth,
        height: displayHeight,
        groundContact: definition.groundContact,
        target: {
          x: window.innerWidth * pose.xVw / 100,
          y: window.innerHeight * pose.groundY,
        },
      });
      gsap.set(slot, {
        x: aligned.left,
        y: aligned.top,
        width: displayWidth,
        height: displayHeight,
        rotation: pose.rotation,
        scale: 1,
        transformOrigin: "0 0",
        opacity: 1,
        visibility: "visible",
      });
      slot.dataset.postheroSlotOpacity = "1";
      slot.dataset.postheroX = aligned.left.toFixed(1);
      slot.dataset.postheroY = aligned.top.toFixed(1);
      slot.dataset.postheroWidth = displayWidth.toFixed(1);

      const stateChanged = previousDisplayed !== lifecycle.displayedState || previous?.visible !== true;
      if (process.env.NODE_ENV !== "production" && stateChanged) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          if (!slot.isConnected || slot.dataset.postheroRequestedState !== pose.state) return;
          const rect = slot.getBoundingClientRect();
          const opacity = Number.parseFloat(slot.style.opacity || "1");
          if (opacity <= 0 || rect.width <= 0 || rect.height <= 0) {
            if (slot.dataset.postheroWarnedState !== pose.state) {
              slot.dataset.postheroWarnedState = pose.state;
              console.warn(`[PostHeroActor] ${actor} should be visible in ${pose.state}, but its slot has no visible geometry.`);
            }
          } else {
            slot.dataset.postheroWarnedState = "";
          }
        }));
      }
    };

    const updateSceneLayers = (frame: PostHeroFrame) => {
      if (frame.chapter === "preparation") {
        if (prepStreet) {
          gsap.set(prepStreet, {
            clipPath: `inset(${(1 - frame.streetReveal) * 100}% 0 0 0)`,
            autoAlpha: frame.streetReveal > 0 ? 1 : 0,
          });
        }
        if (prepPhoto) gsap.set(prepPhoto, { autoAlpha: interpolate(0.72, 1, range(frame.progress, 0, 0.18)) });
      } else {
        if (prepStreet) gsap.set(prepStreet, { clipPath: "inset(100% 0 0 0)", autoAlpha: 0 });
        if (prepPhoto) gsap.set(prepPhoto, { autoAlpha: 1 });
      }

      if (frame.chapter === "journey") {
        if (journeyRoad) gsap.set(journeyRoad, { clipPath: `inset(${(1 - frame.roadReveal) * 100}% 0 0 0)` });
        styleOpacity(custodyPanel, range(frame.custodyProgress, 0.1, 0.35), { y: interpolate(14, 0, frame.custodyProgress) });
        styleOpacity(routeAnnotation, range(frame.routeProgress, 0, 0.1));
      } else {
        if (journeyRoad) gsap.set(journeyRoad, { clipPath: "inset(100% 0 0 0)" });
        styleOpacity(custodyPanel, 0);
        styleOpacity(routeAnnotation, 0);
      }

      if (frame.chapter === "freight") {
        if (freightServices) {
          gsap.set(freightServices, {
            yPercent: 100 * (1 - frame.servicesProgress),
            autoAlpha: frame.servicesProgress > 0 ? 1 : 0,
          });
        }
        if (freightDestination) {
          gsap.set(freightDestination, {
            clipPath: `inset(0 0 0 ${(1 - frame.destinationProgress) * 100}%)`,
            autoAlpha: frame.destinationProgress,
          });
        }
      } else {
        if (freightServices) gsap.set(freightServices, { yPercent: 100, autoAlpha: 0 });
        if (freightDestination) gsap.set(freightDestination, { clipPath: "inset(0 0 0 100%)", autoAlpha: 0 });
      }

      if (frame.chapter === "finale") {
        const brand = frame.brandProgress;
        if (finaleArrival) gsap.set(finaleArrival, { autoAlpha: 1 - range(frame.progress, ...HOME_BEATS.finale.arrivalFade) });
        if (finaleBrandHorizon) gsap.set(finaleBrandHorizon, { height: `${brand * 72}%` });
        if (finaleTitle) gsap.set(finaleTitle, { yPercent: 85 * (1 - brand), autoAlpha: range(brand, 0.18, 0.52) });
        if (finaleDelivered) gsap.set(finaleDelivered, { autoAlpha: range(frame.progress, ...HOME_BEATS.finale.delivered) * (1 - range(frame.progress, ...HOME_BEATS.finale.brandRise)) });
        styleOpacity(finaleUtility, frame.utilityProgress, { y: interpolate(16, 0, frame.utilityProgress) });
        styleOpacity(finaleLegal, frame.legalProgress, { y: interpolate(10, 0, frame.legalProgress) });
      } else {
        if (finaleArrival) gsap.set(finaleArrival, { autoAlpha: 1 });
        if (finaleBrandHorizon) gsap.set(finaleBrandHorizon, { height: 0 });
        if (finaleTitle) gsap.set(finaleTitle, { yPercent: 85, autoAlpha: 0 });
        if (finaleDelivered) gsap.set(finaleDelivered, { autoAlpha: 0 });
        styleOpacity(finaleUtility, 0);
        styleOpacity(finaleLegal, 0);
      }
    };

    const applyMarketplace = (progress: number) => {
      if (!marketplaceSection) return;
      const frame = resolveMarketplaceFrame(progress, categories.length);
      const railFocused = marketplaceKeyboardLock && Boolean(marketRailWrapper?.contains(document.activeElement));
      const manualIndex = marketplaceManualSelectionId ? categoryIds.indexOf(marketplaceManualSelectionId) : -1;
      const selectedIndex = progress >= HOME_BEATS.marketplace.finalCardHold[0] && manualIndex >= 0
        ? manualIndex
        : frame.activeIndex;
      if (progress < HOME_BEATS.marketplace.exitSlices[0]) frozenExitSelectionId = null;

      if (nativeMarketplace) {
        syncNativeMarketplace();
      } else if (marketRail) {
        gsap.set(marketRail, { x: marketplaceTrackX(marketCardCenters, frame.positionIndex, window.innerWidth / 2) });
        if (!railFocused) setMarketplaceActive(selectedIndex);
      }

      const visualIndex = nativeMarketplace
        ? Math.max(0, categories.findIndex(({ id }) => id === activeSelectionId))
        : progress >= HOME_BEATS.marketplace.finalCardHold[0] ? selectedIndex : frame.positionIndex;
      marketCards.forEach((card, index) => {
        card.dataset.marketplaceDistance = String(Math.round(Math.abs(index - visualIndex)));
      });

      if (progress >= HOME_BEATS.marketplace.exitSlices[0] && !frozenExitSelectionId) {
        const chosen = marketplaceManualSelectionId
          ?? (nativeMarketplace
          ? activeSelectionId ?? categories[0]?.id
          : railFocused
            ? activeSelectionId ?? categories[frame.activeIndex]?.id
            : categories[frame.activeIndex]?.id);
        frozenExitSelectionId = chosen ?? null;
        if (frozenExitSelectionId) setMarketplaceSelection(frozenExitSelectionId);
      }
      const selectionId = progress >= HOME_BEATS.marketplace.exitSlices[0]
        ? frozenExitSelectionId
        : progress >= HOME_BEATS.marketplace.finalCardHold[0] && marketplaceManualSelectionId
          ? marketplaceManualSelectionId
          : railFocused && activeSelectionId
          ? activeSelectionId
          : activeSelectionId ?? categories[frame.activeIndex]?.id;
      if (selectionId) setMarketplaceSelection(selectionId);

      const exitProgress = frame.exitProgress;
      const centerOutOrder = [3, 4, 2, 5, 1, 6, 0];
      const mobileExit = window.innerWidth <= 899 && !prefersReducedMotion;
      const exitOrder = mobileExit ? [2, 1, 3, 0, 4] : centerOutOrder;
      const exitSliceCount = mobileExit ? 5 : 7;
      const exitActive = progress >= HOME_BEATS.marketplace.exitSlices[0] && !prefersReducedMotion;
      if (!exitActive || !marketExitLayer || !frozenExitSelectionId) {
        if (marketExitLayer) gsap.set(marketExitLayer, { visibility: "hidden" });
        marketExitSlices.forEach((slice) => gsap.set(slice, { opacity: 0, visibility: "hidden" }));
        if (marketRail) gsap.set(marketRail, { autoAlpha: 1 });
      } else {
        const activeCard = marketCards.find((card) => card.dataset.marketplacePanelId === frozenExitSelectionId);
        const source = activeCard?.getBoundingClientRect();
        if (source && source.width > 0 && source.height > 0) {
          const frameProgress = smooth(range(exitProgress, 0, 0.96));
          const frameLeft = interpolate(source.left, 0, frameProgress);
          const frameTop = interpolate(source.top, 0, frameProgress);
          const frameWidth = interpolate(source.width, window.innerWidth, frameProgress);
          const frameHeight = interpolate(source.height, window.innerHeight, frameProgress);
          const imageBlend = smooth(range(exitProgress, 0.18, 0.86));
          gsap.set(marketExitLayer, { visibility: "visible" });
          if (marketRail) gsap.set(marketRail, { autoAlpha: 1 - range(exitProgress, 0, 0.14) });

          marketExitSlices.forEach((slice, index) => {
            const outgoing = slice.querySelector<HTMLElement>("[data-marketplace-exit-outgoing]");
            const incoming = slice.querySelector<HTMLElement>("[data-marketplace-exit-incoming]");
            const order = exitOrder.indexOf(index);
            const active = order >= 0 && index < exitSliceCount;
            if (!active) {
              gsap.set(slice, { opacity: 0, visibility: "hidden" });
              return;
            }
            const localProgress = smooth(range(exitProgress, order * (mobileExit ? 0.024 : 0.018), 0.96));
            const startLeft = source.left + source.width * index / exitSliceCount;
            const startWidth = source.width / exitSliceCount;
            const targetLeft = window.innerWidth * index / exitSliceCount;
            const targetWidth = window.innerWidth / exitSliceCount;
            const left = interpolate(startLeft, targetLeft, localProgress);
            const top = interpolate(source.top, 0, localProgress);
            const width = interpolate(startWidth, targetWidth, localProgress);
            const height = interpolate(source.height, window.innerHeight, localProgress);
            gsap.set(slice, { left, top, width, height, opacity: 1, visibility: "visible" });
            const imageVars = {
              left: frameLeft - left,
              top: frameTop - top,
              width: frameWidth,
              height: frameHeight,
            };
            if (outgoing) gsap.set(outgoing, { ...imageVars, opacity: 1 - imageBlend });
            if (incoming) gsap.set(incoming, { ...imageVars, opacity: imageBlend });
          });
        } else {
          gsap.set(marketExitLayer, { visibility: "hidden" });
        }
      }

      root.dataset.homeMarketIndex = String(frame.activeIndex);
      root.dataset.homeMarketPosition = frame.positionIndex.toFixed(3);
      root.dataset.homeMotionOwner = frame.motionOwner;
      root.dataset.homeSelectedMarketplaceId = selectionId ?? "";
    };

    const applyPostHero = (chapter: PostHeroChapter, progress: number) => {
      const mode = window.innerWidth <= 767 ? "mobile" : "desktop";
      const frame = resolvePostHeroFrame(chapter, progress, mode);
      updateSceneLayers(frame);
      const showActorStage = chapter === "journey" || chapter === "freight";
      if (postHeroStage) gsap.set(postHeroStage, { opacity: showActorStage ? 1 : 0, visibility: showActorStage ? "visible" : "hidden" });

      if (chapter === "journey" && routePath && frame.actors["white-truck"].visible) {
        const svg = routePath.ownerSVGElement;
        if (svg) {
          if (!routePathLength) {
            routePathLength = routePath.getTotalLength();
            const viewBox = svg.viewBox.baseVal;
            if (viewBox.width > 0 && viewBox.height > 0) routeViewBox = { width: viewBox.width, height: viewBox.height };
          }
          const svgRect = svg.getBoundingClientRect();
          const scaleX = svgRect.width / routeViewBox.width;
          const scaleY = svgRect.height / routeViewBox.height;
          const distance = routePathLength * frame.routeProgress;
          const point = routePath.getPointAtLength(distance);
          const ahead = routePath.getPointAtLength(Math.min(routePathLength, distance + 2));
          let dx = (ahead.x - point.x) * scaleX;
          let dy = (ahead.y - point.y) * scaleY;
          if (Math.abs(dx) + Math.abs(dy) < 0.01) {
            const behind = routePath.getPointAtLength(Math.max(0, distance - 2));
            dx = (point.x - behind.x) * scaleX;
            dy = (point.y - behind.y) * scaleY;
          }
          const tangent = Math.atan2(dy, dx) * (180 / Math.PI);
          const truck = frame.actors["white-truck"];
          truck.xVw = ((svgRect.left + point.x * scaleX) / window.innerWidth) * 100;
          truck.groundY = (svgRect.top + point.y * scaleY) / window.innerHeight;
          truck.rotation = routeTruckRotationForTangent(tangent);
          root.dataset.homeRouteTangent = tangent.toFixed(1);
          root.dataset.homeRouteProgress = frame.routeProgress.toFixed(3);
          root.dataset.homeRouteHeadingOffset = "180";
        }
      }

      (Object.entries(frame.actors) as [PostHeroActorName, PostHeroActorPose][]).forEach(([actor, pose]) => placePersistentActor(actor, pose));
      root.dataset.homeMotionOwner = frame.motionOwner;
      root.dataset.homeProgress = frame.progress.toFixed(3);
      root.dataset.homeWorldOwner = chapter;
      root.dataset.homeVanState = frame.actors.van.visible ? frame.actors.van.state : "hidden";
      root.dataset.homeCourierState = frame.actors.courier.visible ? frame.actors.courier.state : "hidden";
      root.dataset.homeRouteState = frame.actors["white-truck"].visible ? frame.actors["white-truck"].state : "hidden";
      root.dataset.homeRedTruckState = frame.actors["red-truck"].visible ? frame.actors["red-truck"].state : "hidden";
    };

    const measureRanges = () => {
      sceneRanges.length = 0;
      chapterScenes.forEach(({ chapter, section }) => {
        section.dataset.homeMobilePolicy = HOME_MOBILE_POLICY[chapter];
        const rect = section.getBoundingClientRect();
        const start = rect.top + window.scrollY;
        const end = start + Math.max(1, rect.height);
        const stickyStage = section.querySelector<HTMLElement>("[data-home-sticky-stage], [data-marketplace-sticky-stage]");
        const isSticky = Boolean(stickyStage && getComputedStyle(stickyStage).position === "sticky");
        const stickyHeight = chapter === "hero" && window.innerWidth <= 767 && stickyStage
          ? stickyStage.getBoundingClientRect().height || window.innerHeight
          : window.innerHeight;
        const scrollSpan = isSticky ? rect.height - stickyHeight : rect.height;
        sceneRanges.push({ chapter, section, start, end, progressEnd: start + Math.max(1, scrollSpan) });
      });
      marketCardCenters.splice(0, marketCardCenters.length, ...marketCards.map((card) => card.offsetLeft + card.offsetWidth / 2));
      if (actorStage) {
        const rect = actorStage.getBoundingClientRect();
        stageTop = rect.top;
        stageWidth = rect.width || window.innerWidth;
        const navHeight = document.querySelector<HTMLElement>("[data-kt-app-shell='mobile-nav']")?.getBoundingClientRect().height ?? 0;
        heroUsableActorHeight = Math.max(0, rect.height - navHeight);
      }
      routePathLength = 0;
    };

    const rangeForScroll = (scrollY: number): { chapter: HomeChapter; progress: number } => {
      const current = sceneRanges.find((entry) => scrollY >= entry.start && scrollY < entry.end)
        ?? (scrollY < (sceneRanges[0]?.start ?? 0) ? sceneRanges[0] : sceneRanges.at(-1));
      if (!current) return { chapter: "hero", progress: 0 };
      return {
        chapter: current.chapter,
        progress: clamp01((scrollY - current.start) / Math.max(1, current.progressEnd - current.start)),
      };
    };

    const preloadForChapter = (chapter: HomeChapter, progress: number) => {
      if ((chapter === "marketplace" && progress >= 0.04) || chapter === "journey" || chapter === "freight") {
        if (!freightPackStarted) {
          freightPackStarted = true;
          ["white-truck:top-down-straight", "red-truck:side-right"].forEach((state) => {
            const image = postHeroLayers.get(state as PostHeroActorKey);
            if (image) {
              image.loading = "eager";
              image.fetchPriority = "high";
            }
          });
          void preloadPostHeroActorsForChapter("freight");
        }
      }
    };

    const applyChapter = (chapter: HomeChapter, rawProgress: number) => {
      const reducedProgress: Partial<Record<HomeChapter, number>> = {
        hero: 0.5,
        marketplace: 0.5,
        preparation: 0.42,
        journey: 0.68,
        freight: 0.65,
        finale: 0.95,
      };
      const progress = prefersReducedMotion ? reducedProgress[chapter] ?? rawProgress : rawProgress;
      latestChapter = chapter;
      latestProgress = progress;
      root.dataset.homeChapter = chapter;
      root.dataset.homeProgress = progress.toFixed(3);
      root.dataset.homeViewportMode = window.innerWidth <= 767 ? "mobile" : "desktop";
      const postHeroActorsOwnChapter = chapter === "journey" || chapter === "freight";
      if (postHeroStage) gsap.set(postHeroStage, { opacity: postHeroActorsOwnChapter ? 1 : 0, visibility: postHeroActorsOwnChapter ? "visible" : "hidden" });

      const tone = homeHeaderTone(chapter, progress);
      if (tone !== lastTone) {
        lastTone = tone;
        setHeaderTone(tone);
        window.dispatchEvent(new CustomEvent("kt-header-tone", { detail: { tone } }));
      }

      if (chapter === "hero") {
        const presentation = applyHeroActor(progress);
        if (heroKt) gsap.set(heroKt, {
          y: prefersReducedMotion ? 0 : interpolate(0, -14, range(progress, HOME_BEATS.hero.centreSettle[0], HOME_BEATS.hero.cameraPass[1])),
          autoAlpha: prefersReducedMotion ? 1 : interpolate(1, 0.3, range(progress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1])),
        });
        if (heroCourier) gsap.set(heroCourier, {
          y: prefersReducedMotion ? 0 : interpolate(0, 10, range(progress, HOME_BEATS.hero.centreSettle[0], HOME_BEATS.hero.cameraPass[1])),
          autoAlpha: prefersReducedMotion ? 1 : interpolate(1, 0.34, range(progress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1])),
        });
        if (heroRoad) gsap.set(heroRoad, { autoAlpha: prefersReducedMotion ? 0 : 0.24 * range(progress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1]) });
        if (heroActions) {
          const alpha = prefersReducedMotion ? 1 : 1 - range(progress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.entryReveal[1]);
          gsap.set(heroActions, { autoAlpha: alpha, y: prefersReducedMotion ? 0 : interpolate(0, -10, range(progress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.entryReveal[1])) });
        }
        if (presentation) {
          root.dataset.homeWhiteTruckVisible = String(presentation.visible);
          root.dataset.homeWhiteTruckState = presentation.displayedState;
          root.dataset.homeWhiteTruckNextState = resolveHeroTruckFrame(progress, window.innerWidth <= 767 ? "mobile" : "desktop").blendToState ?? "";
          root.dataset.homeWhiteTruckReady = String(presentation.requestedReady);
          root.dataset.homeWhiteTruckBlend = presentation.blend.toFixed(3);
          root.dataset.homeWhiteTruckWidth = presentation.width.toFixed(2);
          root.dataset.homeWhiteTruckHeight = presentation.height.toFixed(2);
          root.dataset.homeWhiteTruckSlotOpacity = presentation.slotOpacity.toFixed(3);
        }
        if (heroSlot) gsap.set(heroSlot, { visibility: "visible" });
        applyMarketplace(0);
      } else {
        if (chapter !== "marketplace") marketplaceKeyboardLock = false;
        if (heroSlot) gsap.set(heroSlot, { autoAlpha: 0, visibility: "hidden" });
        if (marketExitLayer) gsap.set(marketExitLayer, { visibility: "hidden" });
        marketExitSlices.forEach((slice) => gsap.set(slice, { opacity: 0, visibility: "hidden" }));
        if (chapter === "marketplace") {
          applyMarketplace(progress);
        } else {
          frozenExitSelectionId = null;
          applyPostHero(chapter as PostHeroChapter, progress);
        }
      }

      preloadForChapter(chapter, progress);
      root.dataset.homeFinalePhase = chapter === "finale"
        ? progress < HOME_BEATS.finale.brandRise[0] ? "arrival" : progress < HOME_BEATS.finale.utilityReveal[0] ? "brand" : progress < HOME_BEATS.finale.legalReveal[0] ? "utility" : "legal"
        : "";

      const mobileNav = document.querySelector<HTMLElement>("[data-kt-app-shell='mobile-nav']");
      if (mobileNav && window.innerWidth <= 767) {
        const hideNav = chapter === "finale" && progress >= 0.72;
        mobileNav.dataset.homeFinaleHidden = String(hideNav);
        mobileNav.inert = hideNav;
      }
      if (debugPanel && debugEnabled) debugPanel.textContent = `${chapter} · ${progress.toFixed(3)} · ${root.dataset.homeMotionOwner ?? "none"}`;
    };

    const seekFromScroll = (scrollY = window.scrollY) => {
      const { chapter, progress } = rangeForScroll(scrollY);
      applyChapter(chapter, progress);
    };

    function scheduleFrame() {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        seekFromScroll(window.scrollY);
      });
    }

    const resizeDirector = () => {
      const frozenChapter = latestChapter;
      const frozenProgress = latestProgress;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        nativeMarketplace = prefersReducedMotion || window.matchMedia("(max-width: 899px)").matches;
        ScrollTrigger.refresh();
        measureRanges();
        const target = sceneRanges.find((entry) => entry.chapter === frozenChapter);
        if (target) window.scrollTo(0, target.start + frozenProgress * (target.progressEnd - target.start));
        syncNativeMarketplace();
        seekFromScroll(window.scrollY);
      }, 140);
    };

    const trigger = ScrollTrigger.create({ trigger: root, start: "top top", end: "bottom bottom", scrub: true, invalidateOnRefresh: true });
    const context = gsap.context(() => {}, root);
    window.addEventListener("scroll", scheduleFrame, { passive: true });
    window.addEventListener("resize", resizeDirector, { passive: true });
    marketRailWrapper?.addEventListener("scroll", syncNativeMarketplace, { passive: true });
    window.addEventListener("kt-marketplace-user-selection", onMarketplaceUserSelection);
    window.addEventListener("kt-posthero-actor-ready", scheduleFrame);

    const onMarketplaceKeyDown = (event: KeyboardEvent) => {
      if (!marketRailWrapper || !marketRailWrapper.contains(document.activeElement) || nativeMarketplace) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      marketplaceKeyboardLock = true;
      const currentIndex = Math.max(0, categories.findIndex(({ id }) => id === activeSelectionId));
      const nextIndex = Math.max(0, Math.min(categories.length - 1, currentIndex + (event.key === "ArrowRight" ? 1 : -1)));
      setMarketplaceActive(nextIndex);
      const button = marketCards[nextIndex]?.querySelector<HTMLButtonElement>("button");
      button?.focus({ preventScroll: true });
    };
    const onMarketplaceWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) >= Math.abs(event.deltaX)) marketplaceKeyboardLock = false;
    };
    marketRailWrapper?.addEventListener("keydown", onMarketplaceKeyDown);
    marketRailWrapper?.addEventListener("wheel", onMarketplaceWheel, { passive: true });

    const measureAndSeek = async () => {
      await document.fonts?.ready;
      ScrollTrigger.refresh();
      measureRanges();
      if (!prefersReducedMotion) {
        HERO_TRUCK_SEQUENCE.slice(0, 6).forEach((state) => requestHeroImageDecode(heroLayers.get(state), "high"));
        HERO_TRUCK_SEQUENCE.slice(6).forEach((state) => requestHeroImageDecode(heroLayers.get(state)));
      }
      seekFromScroll(window.scrollY);
    };

    measureRanges();
    syncNativeMarketplace();
    seekFromScroll(window.scrollY);
    void measureAndSeek();

    return () => {
      window.clearTimeout(resizeTimer);
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", scheduleFrame);
      window.removeEventListener("resize", resizeDirector);
      marketRailWrapper?.removeEventListener("scroll", syncNativeMarketplace);
      window.removeEventListener("kt-marketplace-user-selection", onMarketplaceUserSelection);
      window.removeEventListener("kt-posthero-actor-ready", scheduleFrame);
      marketRailWrapper?.removeEventListener("keydown", onMarketplaceKeyDown);
      marketRailWrapper?.removeEventListener("wheel", onMarketplaceWheel);
      const mobileNav = document.querySelector<HTMLElement>("[data-kt-app-shell='mobile-nav']");
      if (mobileNav) {
        mobileNav.dataset.homeFinaleHidden = "false";
        mobileNav.inert = false;
      }
      trigger.kill();
      context.revert();
    };
  }, [rootRef, categories, enabled, onMarketplaceSelectionChange, prefersReducedMotion, setHeaderTone]);
}
