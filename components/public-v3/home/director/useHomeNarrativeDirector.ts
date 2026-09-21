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
  preloadPostHeroActor,
  preloadPostHeroActorsForChapter,
} from "../actors/post-hero-actor-preload";
import type { PostHeroActorKey } from "./post-hero-frame-resolver";

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

    const localSlots = Array.from(root.querySelectorAll<HTMLElement>("[data-posthero-actor-slot]"));
    const localLayers = new Map<string, HTMLImageElement>();
    localSlots.forEach((slot) => {
      const scene = slot.dataset.postheroScene ?? "";
      const actor = slot.dataset.postheroActorSlot ?? "";
      slot.querySelectorAll<HTMLImageElement>("[data-posthero-actor-state]").forEach((image) => {
        const key = image.dataset.postheroActorState;
        if (key) localLayers.set(`${scene}:${actor}:${key}`, image);
        gsap.set(image, { opacity: 0, visibility: "visible" });
      });
      gsap.set(slot, { opacity: 0, visibility: "hidden" });
    });
    void Promise.all([
      preloadPostHeroActorsForChapter("journey"),
      preloadPostHeroActorsForChapter("freight"),
      preloadPostHeroActorsForChapter("finale"),
    ]);

    const storyMediaLayer = root.querySelector<HTMLElement>("[data-persistent-story-media]");
    const storyMediaFrame = root.querySelector<HTMLElement>("[data-story-media-frame]");
    const storyMediaImages = new Map<string, HTMLImageElement>();
    root.querySelectorAll<HTMLImageElement>("[data-story-media-id]").forEach((image) => {
      const id = image.dataset.storyMediaId;
      if (id) storyMediaImages.set(id, image);
    });
    const marketplaceSection = root.querySelector<HTMLElement>("[data-kt-scene='marketplace']");
    const marketRailWrapper = root.querySelector<HTMLElement>("[data-marketplace-rail-wrapper]");
    const marketRail = root.querySelector<HTMLElement>("[data-motion='market-rail']");
    const marketCards = Array.from(root.querySelectorAll<HTMLElement>("[data-marketplace-panel-id]"));
    const marketPortal = root.querySelector<HTMLElement>("[data-marketplace-portal]");
    const marketPortalCenter = root.querySelector<HTMLElement>("[data-marketplace-portal-center]");
    const marketSupports = Array.from(root.querySelectorAll<HTMLElement>("[data-marketplace-portal-support-id]"));
    const marketExitSlices = Array.from(root.querySelectorAll<HTMLElement>("[data-marketplace-exit-slice]"));
    const prepTarget = root.querySelector<HTMLElement>("[data-preparation-target]");
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
    const activeActorState = new Map<string, PostHeroActorKey>();
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
      storyMediaImages.forEach((image, imageId) => {
        gsap.set(image, { autoAlpha: imageId === id ? 1 : 0 });
        if (imageId === id) {
          image.loading = "eager";
          image.fetchPriority = "high";
        }
      });
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

    const hideLocalActorSlots = () => {
      localSlots.forEach((slot) => gsap.set(slot, { autoAlpha: 0, visibility: "hidden" }));
    };

    const actorReady = (key: PostHeroActorKey, image: HTMLImageElement | undefined) =>
      isPostHeroActorReady(key) || Boolean(image?.complete && image.naturalWidth > 0);

    const placeLocalActor = (chapter: PostHeroChapter, actor: string, pose: PostHeroActorPose) => {
      const slot = localSlots.find((item) => item.dataset.postheroScene === chapter && item.dataset.postheroActorSlot === actor);
      if (!slot) return;
      const cacheKey = `${chapter}:${actor}`;
      const imageKey = `${chapter}:${actor}:${pose.state}`;
      const requestedLayer = localLayers.get(imageKey);
      const ready = actorReady(pose.state, requestedLayer);
      let displayedState = pose.state;

      if (!ready) {
        const pendingState = slot.dataset.postheroPendingState;
        if (pendingState !== pose.state) {
          slot.dataset.postheroPendingState = pose.state;
          void preloadPostHeroActor(pose.state).then((loaded) => {
            if (!loaded) return;
            const currentScene = root.dataset.homeChapter;
            const currentState = slot.dataset.postheroPendingState;
            if (currentScene === chapter && currentState === pose.state) scheduleFrame();
          });
        }
        const priorState = activeActorState.get(cacheKey);
        const readyFallback = Array.from(localLayers.entries()).find(([key, image]) =>
          key.startsWith(`${chapter}:${actor}:`) && actorReady(image.dataset.postheroActorState as PostHeroActorKey, image),
        )?.[0].split(":").slice(2).join(":") as PostHeroActorKey | undefined;
        displayedState = priorState ?? readyFallback ?? pose.state;
      } else {
        activeActorState.set(cacheKey, pose.state);
        slot.dataset.postheroPendingState = "";
      }

      const layerKey = `${chapter}:${actor}:${displayedState}`;
      const layer = localLayers.get(layerKey);
      if (!layer || !actorReady(displayedState, layer)) {
        gsap.set(slot, { autoAlpha: 0, visibility: "hidden" });
        return;
      }
      slot.querySelectorAll<HTMLImageElement>("[data-posthero-actor-state]").forEach((image) => {
        gsap.set(image, { opacity: image === layer ? 1 : 0, visibility: "visible" });
        image.dataset.postheroActorStatus = actorReady(image.dataset.postheroActorState as PostHeroActorKey, image) ? "ready" : "loading";
      });

      const visibleStateDefinition = POST_HERO_ACTOR_ASSETS[displayedState];
      const displayWidth = window.innerWidth * pose.widthVw / 100;
      const displayHeight = displayWidth / Math.max(0.01, visibleStateDefinition.aspectRatio);
      const aligned = alignGroundContact({
        width: displayWidth,
        height: displayHeight,
        groundContact: visibleStateDefinition.groundContact,
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
        autoAlpha: 1,
        visibility: "visible",
      });
      slot.dataset.postheroActorState = displayedState;
      slot.dataset.postheroRequestedState = pose.state;
      slot.dataset.postheroActorReady = String(actorReady(displayedState, layer));
    };

    const updateSceneLayers = (frame: PostHeroFrame) => {
      if (frame.chapter === "preparation") {
        styleOpacity(prepStreet, frame.streetReveal, {
          height: `${interpolate(7, window.innerHeight * 0.35, frame.streetReveal)}px`,
        });
        if (prepPhoto) gsap.set(prepPhoto, { autoAlpha: interpolate(0.72, 1, range(frame.progress, 0, 0.18)) });
        if (storyMediaLayer && storyMediaFrame) {
          const mediaProgress = frame.prepMediaProgress;
          const target = prepPhoto?.getBoundingClientRect();
          if (target && mediaProgress < 1) {
            gsap.set(storyMediaLayer, { visibility: "visible" });
            gsap.set(storyMediaFrame, {
              left: target.left,
              top: target.top,
              width: target.width,
              height: target.height,
              autoAlpha: 1 - mediaProgress,
            });
          } else {
            gsap.set(storyMediaLayer, { visibility: "hidden" });
            gsap.set(storyMediaFrame, { autoAlpha: 0 });
          }
        }
      } else {
        styleOpacity(prepStreet, 0, { height: 0 });
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
        if (finaleBrandHorizon) gsap.set(finaleBrandHorizon, { height: `${brand * 100}%` });
        if (finaleTitle) gsap.set(finaleTitle, { yPercent: 85 * (1 - brand), autoAlpha: range(brand, 0.18, 0.52) });
        if (finaleDelivered) gsap.set(finaleDelivered, { autoAlpha: 1 - range(frame.progress, ...HOME_BEATS.finale.deliveredHold) });
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
      const portalIndex = progress >= 0.84 && manualIndex >= 0 ? manualIndex : frame.activeIndex;
      if (progress < 0.91) frozenExitSelectionId = null;

      if (nativeMarketplace) {
        syncNativeMarketplace();
      } else if (marketRail && progress < 0.84) {
        gsap.set(marketRail, { x: marketplaceTrackX(marketCardCenters, frame.positionIndex, window.innerWidth / 2) });
        if (!railFocused) setMarketplaceActive(frame.activeIndex);
      } else if (progress >= 0.84 && progress < 0.91) {
        if (marketRail && manualIndex >= 0) {
          gsap.set(marketRail, { x: marketplaceTrackX(marketCardCenters, portalIndex, window.innerWidth / 2) });
        }
        if (!railFocused) setMarketplaceActive(portalIndex);
      }

      const visualIndex = nativeMarketplace
        ? Math.max(0, categories.findIndex(({ id }) => id === activeSelectionId))
        : progress >= 0.84 ? portalIndex : frame.positionIndex;
      marketCards.forEach((card, index) => {
        card.dataset.marketplaceDistance = String(Math.round(Math.abs(index - visualIndex)));
      });

      if (progress >= 0.91 && !frozenExitSelectionId) {
        const chosen = marketplaceManualSelectionId
          ?? (nativeMarketplace
          ? activeSelectionId ?? categories[0]?.id
          : railFocused
            ? activeSelectionId ?? categories[frame.activeIndex]?.id
            : categories[frame.activeIndex]?.id);
        frozenExitSelectionId = chosen ?? null;
        if (frozenExitSelectionId) setMarketplaceSelection(frozenExitSelectionId);
      }
      const selectionId = progress >= 0.91
        ? frozenExitSelectionId
        : progress >= 0.84 && marketplaceManualSelectionId
          ? marketplaceManualSelectionId
          : railFocused && activeSelectionId
          ? activeSelectionId
          : activeSelectionId ?? categories[frame.activeIndex]?.id;
      if (selectionId) setMarketplaceSelection(selectionId);

      const portalProgress = range(progress, 0.84, 0.875);
      styleOpacity(marketPortal, portalProgress);
      if (marketPortal) gsap.set(marketPortal, { visibility: portalProgress > 0 ? "visible" : "hidden" });
      if (marketRail) gsap.set(marketRail, { autoAlpha: 1 - portalProgress });
      const supportCandidates = marketSupports.filter((support) => support.dataset.marketplacePortalSupportId !== selectionId).slice(0, 4);
      const visibleSupports = new Set(supportCandidates);
      marketSupports.forEach((support) => {
        const index = supportCandidates.indexOf(support);
        if (!visibleSupports.has(support)) {
          delete support.dataset.marketplaceSupportSlot;
          gsap.set(support, { autoAlpha: 0 });
          return;
        }
        const side = index < 2 ? -1 : 1;
        const depth = index % 2 === 0 ? 1 : 0.78;
        support.dataset.marketplaceSupportSlot = String(index);
        gsap.set(support, {
          x: side * (window.innerWidth * 0.12 + index * 4),
          y: interpolate(24, 0, portalProgress) + (index % 2 ? 18 : -8),
          scale: interpolate(0.82, depth, portalProgress),
          autoAlpha: portalProgress,
        });
      });
      const exitProgress = range(progress, ...HOME_BEATS.marketplace.exitSlices);
      const centerOutOrder = [3, 4, 2, 5, 1, 6, 0];
      const mobileExit = window.innerWidth <= 899 && !prefersReducedMotion;
      const exitOrder = mobileExit ? [2, 1, 3, 0, 4] : centerOutOrder;
      const exitSliceCount = mobileExit ? 5 : 7;
      marketExitSlices.forEach((slice, index) => {
        const order = exitOrder.indexOf(index);
        const local = order < 0 ? 0 : clamp01((exitProgress - order * (mobileExit ? 0.08 : 0.055)) / 0.48);
        gsap.set(slice, {
          autoAlpha: local,
          clipPath: `inset(0 ${(1 - local) * 50}% 0 ${(1 - local) * 50}%)`,
          backgroundSize: `${exitSliceCount * 100}% 100%`,
          backgroundPosition: `${(index / (exitSliceCount - 1)) * 100}% 50%`,
        });
      });

      if (storyMediaLayer && storyMediaFrame) {
        const isHandoff = progress >= HOME_BEATS.marketplace.mediaHandoff[0];
        const id = isHandoff ? frozenExitSelectionId : selectionId;
        storyMediaImages.forEach((image, imageId) => gsap.set(image, { autoAlpha: imageId === id ? 1 : 0 }));
        if (isHandoff && id) {
          const source = marketPortalCenter?.getBoundingClientRect() ?? marketCards.find((card) => card.dataset.marketplacePanelId === id)?.getBoundingClientRect();
          const target = prepTarget?.getBoundingClientRect();
          const handoff = range(progress, ...HOME_BEATS.marketplace.mediaHandoff);
          if (source && target) {
            gsap.set(storyMediaLayer, { visibility: "visible" });
            gsap.set(storyMediaFrame, {
              left: interpolate(0, target.left, handoff),
              top: interpolate(0, target.top, handoff),
              width: interpolate(window.innerWidth, target.width, handoff),
              height: interpolate(window.innerHeight, target.height, handoff),
              autoAlpha: 1,
            });
            if (handoff === 0) gsap.set(storyMediaFrame, { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
          }
        } else {
          gsap.set(storyMediaLayer, { visibility: "hidden" });
          gsap.set(storyMediaFrame, { autoAlpha: 0 });
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
      hideLocalActorSlots();

      if (chapter === "journey" && routePath && frame.actors["white-truck"]?.visible) {
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
          if (truck) {
            truck.xVw = ((svgRect.left + point.x * scaleX) / window.innerWidth) * 100;
            truck.groundY = (svgRect.top + point.y * scaleY) / window.innerHeight;
            truck.rotation = routeTruckRotationForTangent(tangent);
          }
          root.dataset.homeRouteTangent = tangent.toFixed(1);
          root.dataset.homeRouteProgress = frame.routeProgress.toFixed(3);
          root.dataset.homeRouteHeadingOffset = "180";
        }
      }

      Object.entries(frame.actors).forEach(([actor, pose]) => {
        if (pose?.visible) placeLocalActor(chapter, actor, pose);
      });
      root.dataset.homeMotionOwner = frame.motionOwner;
      root.dataset.homeProgress = frame.progress.toFixed(3);
      root.dataset.homeWorldOwner = chapter;
      root.dataset.homeVanState = frame.actors.van?.state ?? "hidden";
      root.dataset.homeCourierState = frame.actors.courier?.state ?? "hidden";
      root.dataset.homeRouteState = frame.actors["white-truck"]?.state ?? "hidden";
      root.dataset.homeRedTruckState = frame.actors["red-truck"]?.state ?? "hidden";
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
      if (chapter === "marketplace" && progress >= 0.4) void preloadPostHeroActorsForChapter("journey");
      if (chapter === "journey") {
        void preloadPostHeroActorsForChapter("journey");
        if (progress >= 0.55) void preloadPostHeroActorsForChapter("freight");
      }
      if (chapter === "freight") {
        void preloadPostHeroActorsForChapter("freight");
        if (progress >= 0.65) void preloadPostHeroActorsForChapter("finale");
      }
      if (chapter === "finale") void preloadPostHeroActorsForChapter("finale");
    };

    const applyChapter = (chapter: HomeChapter, rawProgress: number) => {
      const reducedProgress: Partial<Record<HomeChapter, number>> = {
        hero: 0.5,
        marketplace: 0.5,
        preparation: 0.42,
        journey: 0.78,
        freight: 0.65,
        finale: 0.75,
      };
      const progress = prefersReducedMotion ? reducedProgress[chapter] ?? rawProgress : rawProgress;
      latestChapter = chapter;
      latestProgress = progress;
      root.dataset.homeChapter = chapter;
      root.dataset.homeProgress = progress.toFixed(3);
      root.dataset.homeViewportMode = window.innerWidth <= 767 ? "mobile" : "desktop";

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
        if (chapter === "marketplace") {
          applyMarketplace(progress);
          const exitImage = progress >= 0.91 ? frozenExitSelectionId : activeSelectionId;
          if (exitImage) void preloadPostHeroActorsForChapter("journey");
          localSlots.forEach((slot) => gsap.set(slot, { autoAlpha: 0, visibility: "hidden" }));
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
        const hideNav = chapter === "finale" && progress >= 0.62;
        mobileNav.dataset.homeFinaleHidden = String(hideNav);
        mobileNav.inert = hideNav;
      }
      if (debugPanel && debugEnabled) debugPanel.textContent = `${chapter} · ${progress.toFixed(3)} · ${root.dataset.homeMotionOwner ?? "none"}`;
    };

    const seekFromScroll = (scrollY = window.scrollY) => {
      const { chapter, progress } = rangeForScroll(scrollY);
      const chapterIndex = HOME_CHAPTERS.indexOf(chapter);
      const next = HOME_CHAPTERS[chapterIndex + 1];
      if (next === "journey" && progress >= 0.55) void preloadPostHeroActorsForChapter("journey");
      if (next === "freight" && progress >= 0.55) void preloadPostHeroActorsForChapter("freight");
      if (next === "finale" && progress >= 0.55) void preloadPostHeroActorsForChapter("finale");
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
