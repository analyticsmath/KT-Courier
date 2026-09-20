"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionContext } from "../../motion/PublicMotionProvider";
import {
  COURIER_STATES,
  RED_TRUCK_STATES,
  VAN_DOOR_CALIBRATION,
  VAN_STATES,
  WHITE_TRUCK_STATES,
  HERO_TRUCK_SEQUENCE,
  type ActorStateDefinition,
} from "../../actors/actor-state-machine";
import type { HomeChapter } from "./home-chapters";
import { HOME_CHAPTERS } from "./home-chapters";
import { clamp01, HOME_BEATS, range } from "./home-beats";
import { formatHomeDebugFrame } from "./home-debug";
import { alignGroundContact } from "./home-grounding";
import { assertPhysicalCoverage, physicalCoverage } from "./home-occlusion";
import {
  assertActorTransition,
  isAdjacentHeroSequenceTransition,
  validateHomeActorTransitions,
  type ActorType,
} from "./home-actor-transitions";
import { resolveHomeFrame, type ActorFrame, type HomeFrame } from "./home-frame-resolver";
import type { HomepageCategoryVisual } from "./home-category-media";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

type ActorName = "whiteTruck" | "van" | "courier" | "redTruck";
type ActorSlotName = "white-truck" | "van" | "courier" | "red-truck";
type SceneRange = { chapter: HomeChapter; section: HTMLElement; start: number; end: number; progressEnd: number };
type ProgressTimeline = { timeline: gsap.core.Timeline; proxy: { progress: number } };
type FanTransferGeometry = {
  source: { left: number; top: number; width: number; height: number };
  targetDocument: { left: number; top: number; width: number; height: number };
};

const ACTOR_TYPES: Record<ActorName, ActorType> = {
  whiteTruck: "white-truck",
  van: "van",
  courier: "courier",
  redTruck: "red-truck",
};
const ACTOR_SLOTS: Record<ActorName, ActorSlotName> = {
  whiteTruck: "white-truck",
  van: "van",
  courier: "courier",
  redTruck: "red-truck",
};
const ACTOR_STATES: Record<ActorType, Record<string, ActorStateDefinition>> = {
  "white-truck": WHITE_TRUCK_STATES,
  van: VAN_STATES,
  courier: COURIER_STATES,
  "red-truck": RED_TRUCK_STATES,
};

const PRELOAD_STATES: Record<HomeChapter, Partial<Record<ActorName, string[]>>> = {
  hero: { whiteTruck: HERO_TRUCK_SEQUENCE.slice(0, 6) },
  marketplace: {},
  fan: {},
  preparation: {},
  collection: {
    van: ["motion-transition", "side-left", "sliding-door-open"],
    courier: ["look-left-approach", "lift-parcel", "loading-unloading"],
  },
  custody: { courier: ["loading-unloading", "ready-handover"] },
  route: { whiteTruck: ["top-down-straight", "top-down-angled", "top-down-turning"] },
  freight: { redTruck: ["side-right"] },
  arrival: { courier: ["walk-left-one-parcel", "extending-handoff"] },
  finale: {},
};

function chapterFromSection(section: HTMLElement): HomeChapter | null {
  const name = section.dataset.ktScene;
  if (name === "image-fan") return "fan";
  return HOME_CHAPTERS.includes(name as HomeChapter) ? (name as HomeChapter) : null;
}

function createNormalizedTimeline(onProgress: (progress: number) => void): ProgressTimeline {
  const proxy = { progress: 0 };
  const timeline = gsap.timeline({ paused: true });
  timeline.to(proxy, {
    progress: 1,
    duration: 1,
    ease: "none",
    onUpdate: () => onProgress(proxy.progress),
  }, 0);
  if (process.env.NODE_ENV !== "production" && Math.abs(timeline.duration() - 1) >= 0.001) {
    throw new Error(`[HomeDirector] Chapter timeline must have duration 1. Found ${timeline.duration()}.`);
  }
  return { timeline, proxy };
}

function marketplaceWord(category: HomepageCategoryVisual | undefined): string {
  return category?.categoryWord?.trim() || category?.title.trim().split(/\s+/)[0]?.toUpperCase() || "LOCAL";
}

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smooth(amount: number): number {
  return amount * amount * (3 - 2 * amount);
}

function applyFanMotion(cards: HTMLElement[], progress: number, transfer?: FanTransferGeometry | null): void {
  const p = clamp01(progress);
  const spread = range(p, 0.12, 0.32);
  const compress = range(p, 0.5, 0.68);
  const contract = range(p, 0.8, 0.92);
  const parcel = range(p, 0.92, 1);
  const offsetScale = Math.max(0.45, Math.min(1, window.innerWidth / 1024));

  cards.forEach((card) => {
    const isHero = card.dataset.isHero === "true";
    gsap.set(card, { transformOrigin: "bottom center" });
    const rawX = Number(card.dataset.fanX ?? 0);
    const baseX = window.innerWidth <= 599
      ? Math.sign(rawX) * (Math.abs(rawX) < 200 ? window.innerWidth * 0.36 : window.innerWidth * 0.54)
      : rawX * offsetScale;
    const baseY = Number(card.dataset.fanY ?? 0);
    const baseRotation = Number(card.dataset.fanRot ?? 0);
    if (p < 0.12) {
      gsap.set(card, { x: 0, y: 36, rotation: 0, scale: isHero ? 0.94 : 0.78, autoAlpha: isHero ? 1 : 0.15 });
    } else if (p < 0.32) {
      gsap.set(card, {
        x: interpolate(0, baseX, spread),
        y: interpolate(12, baseY, spread),
        rotation: baseRotation * spread,
        scale: isHero ? 1 : interpolate(0.82, 1, spread),
        autoAlpha: isHero ? 1 : interpolate(0.25, 1, spread),
      });
    } else if (p < 0.5) {
      gsap.set(card, { x: baseX, y: baseY, rotation: baseRotation, scale: 1, autoAlpha: 1 });
    } else if (p < 0.68) {
      gsap.set(card, {
        x: baseX * (1 - compress),
        y: baseY * (1 - compress),
        rotation: baseRotation * (1 - compress),
        scale: isHero ? 1 : 1 - compress * 0.1,
        autoAlpha: isHero ? 1 : 1 - compress * 0.78,
      });
    } else if (p < 0.8) {
      gsap.set(card, { x: 0, y: 0, rotation: 0, scale: isHero ? 1.05 : 0.72, autoAlpha: isHero ? 1 : 0 });
    } else if (p < 0.92) {
      gsap.set(card, { x: 0, y: 0, rotation: 0, scale: isHero ? 1.05 - contract * 0.18 : 0, autoAlpha: isHero ? 1 : 0 });
    } else if (isHero && transfer) {
      const handoff = range(p, 0.92, 1);
      const targetLeft = transfer.targetDocument.left - window.scrollX;
      const targetTop = transfer.targetDocument.top - window.scrollY;
      const targetCenterX = targetLeft + transfer.targetDocument.width / 2;
      const targetCenterY = targetTop + transfer.targetDocument.height / 2;
      const sourceCenterX = transfer.source.left + transfer.source.width / 2;
      const sourceCenterY = transfer.source.top + transfer.source.height / 2;
      const scaleRatio = transfer.source.width > 0
        ? transfer.targetDocument.width / transfer.source.width
        : 1;
      gsap.set(card, {
        x: (targetCenterX - sourceCenterX) * handoff,
        y: (targetCenterY - sourceCenterY) * handoff,
        rotation: 0,
        transformOrigin: "50% 50%",
        scale: 0.87 * interpolate(1, scaleRatio, handoff),
        autoAlpha: 1,
      });
    } else {
      gsap.set(card, { x: 0, y: 0, rotation: 0, scale: isHero ? 0.87 - parcel * 0.08 : 0, autoAlpha: isHero ? 1 : 0 });
    }
  });
}

export function useHomeNarrativeDirector({
  rootRef,
  categories,
  enabled,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  categories: HomepageCategoryVisual[];
  enabled: boolean;
}): void {
  const { prefersReducedMotion, setHeaderTone } = useMotionContext();

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const actorStage = root.querySelector<HTMLElement>("[data-kt-actor-stage]");
    const physicalOccluders = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>("[data-home-occluder]").forEach((element) => {
      const id = element.dataset.homeOccluder;
      if (id) physicalOccluders.set(id, element);
    });
    const debugPanel = root.querySelector<HTMLElement>("[data-kt-motion-debug]");
    const debugGeometry = root.querySelector<HTMLElement>("[data-kt-motion-debug-geometry]");
    const debugEnabled = process.env.NODE_ENV !== "production"
      && new URLSearchParams(window.location.search).get("ktMotionDebug") === "1";
    if (debugPanel) debugPanel.hidden = !debugEnabled;
    if (debugGeometry) debugGeometry.hidden = !debugEnabled;
    root.dataset.ktMotionDebug = String(debugEnabled);

    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-kt-scene]"))
      .map((section) => ({ section, chapter: chapterFromSection(section) }))
      .filter((item): item is { section: HTMLElement; chapter: HomeChapter } => item.chapter !== null)
      .sort((a, b) => HOME_CHAPTERS.indexOf(a.chapter) - HOME_CHAPTERS.indexOf(b.chapter));
    const slotNodes = new Map<ActorName, HTMLElement>();
    const stateLayers = new Map<ActorName, Map<string, HTMLImageElement>>();
    const decodedActorImages = new WeakSet<HTMLImageElement>();
    const pendingActorDecodes = new WeakMap<HTMLImageElement, Promise<boolean>>();
    let refreshFrameAfterDecode: (() => void) | null = null;
    (Object.keys(ACTOR_SLOTS) as ActorName[]).forEach((actor) => {
      const slot = root.querySelector<HTMLElement>(`[data-actor-slot='${ACTOR_SLOTS[actor]}']`);
      if (!slot) return;
      slotNodes.set(actor, slot);
      const layers = new Map<string, HTMLImageElement>();
      slot.querySelectorAll<HTMLImageElement>("[data-actor-state-layer]").forEach((layer) => {
        layers.set(layer.dataset.actorStateLayer ?? "", layer);
        gsap.set(layer, { autoAlpha: 0 });
      });
      stateLayers.set(actor, layers);
    });

    const isActorImageDecoded = (image: HTMLImageElement | undefined): boolean => {
      return Boolean(image && (decodedActorImages.has(image) || image.dataset.actorStateDecoded === "true"));
    };

    const requestActorImageDecode = (image: HTMLImageElement | undefined, priority: "high" | "auto" = "auto") => {
      if (!image) return;
      image.loading = "eager";
      image.fetchPriority = priority;
      if (isActorImageDecoded(image)) return;
      if (pendingActorDecodes.has(image)) return;

      const pending = Promise.resolve()
        .then(() => typeof image.decode === "function" ? image.decode() : undefined)
        .then(() => {
          if (image.complete && image.naturalWidth > 0) {
            decodedActorImages.add(image);
            image.dataset.actorStateDecoded = "true";
            return true;
          }
          return false;
        })
        .catch(() => false);
      pendingActorDecodes.set(image, pending);
      void pending.then((decoded) => {
        pendingActorDecodes.delete(image);
        if (decoded && refreshFrameAfterDecode) {
          window.requestAnimationFrame(refreshFrameAfterDecode);
        }
      });
    };

    const cards = Array.from(root.querySelectorAll<HTMLElement>(".kt-fan-card"));
    const fanHeroCard = root.querySelector<HTMLElement>(".kt-fan-hero-card");
    const prepParcelTarget = root.querySelector<HTMLElement>("[data-preparation-parcel-target='true']");
    const fanSelectedLabel = root.querySelector<HTMLElement>("[data-fan-selected-label]");
    const fanMediaLayers = new Map<string, HTMLElement>();
    const fanMediaImages = new Map<string, HTMLImageElement>();
    root.querySelectorAll<HTMLElement>("[data-fan-media-id]").forEach((layer) => {
      const id = layer.dataset.fanMediaId;
      if (!id) return;
      fanMediaLayers.set(id, layer);
      const image = layer instanceof HTMLImageElement
        ? layer
        : layer.querySelector<HTMLImageElement>("[data-fan-selected-image]");
      if (image) fanMediaImages.set(id, image);
    });
    const marketCards = Array.from(root.querySelectorAll<HTMLElement>("[data-marketplace-panel-id]"));
    const marketRail = root.querySelector<HTMLElement>("[data-motion='market-rail']");
    const marketRailWrapper = root.querySelector<HTMLElement>("[data-marketplace-rail-wrapper]");
    const marketWord = root.querySelector<HTMLElement>("[data-motion='market-word']");
    const doorAperture = root.querySelector<HTMLElement>("[data-van-door-aperture]");
    const routePath = root.querySelector<SVGPathElement>("[data-route-path]");
    const custodyLeft = root.querySelector<HTMLElement>(".kt-custody-left");
    const custodyRight = root.querySelector<HTMLElement>(".kt-custody-right");
    const custodyConcealment = root.querySelector<HTMLElement>(".kt-custody-route-concealment");
    const finaleRoad = root.querySelector<HTMLElement>("[data-motion='finale-road']");
    const heroRoad = root.querySelector<HTMLElement>("[data-motion='hero-road']");
    const heroKt = root.querySelector<HTMLElement>("[data-motion='hero-kt']");
    const heroCourier = root.querySelector<HTMLElement>("[data-motion='hero-courier']");
    const heroActions = root.querySelector<HTMLElement>("[data-motion='hero-actions']");
    const prepCollectionIncoming = root.querySelector<HTMLElement>("[data-motion='prep-collection-incoming']");
    const arrivalFooterTitle = root.querySelector<HTMLElement>("[data-motion='arrival-footer-title']");
    const finaleTitle = root.querySelector<HTMLElement>("[data-motion='finale-title']");
    const finaleUtility = root.querySelector<HTMLElement>("[data-motion='finale-utility']");
    const finaleLegal = root.querySelector<HTMLElement>("[data-motion='finale-legal']");

    const categoryIds = categories.map(({ id }) => ({ id }));
    const ranges: SceneRange[] = [];
    const timelines = new Map<HomeChapter, ProgressTimeline>();
    const lastLayerState = new Map<ActorName, string>();
    let lastMarketplaceIndex = -1;
    let activeSelectionId: string | null = null;
    let useNativeMarketRail = window.matchMedia("(max-width: 899px)").matches;
    let lastTone: HomeFrame["headerTone"] | null = null;
    let lastFrame: HomeFrame | null = null;
    let measuredCardStep = 0;
    let stageTopPx = actorStage?.getBoundingClientRect().top ?? 0;
    let fanTransferGeometry: FanTransferGeometry | null = null;
    let resizeTimer = 0;
    let isInitialized = false;
    let routePathLength = 0;
    let routePathViewBox = { width: 1000, height: 800 };

    const setMarketplaceActive = (index: number) => {
      const safeIndex = Math.max(0, Math.min(marketCards.length - 1, index));
      if (safeIndex === lastMarketplaceIndex) return;
      lastMarketplaceIndex = safeIndex;
      marketCards.forEach((card, cardIndex) => {
        const active = cardIndex === safeIndex;
        card.dataset.marketplaceActive = String(active);
        card.setAttribute("aria-current", active ? "true" : "false");
      });
      if (marketWord) marketWord.textContent = marketplaceWord(categories[safeIndex]);
      const selectedCategory = categories[safeIndex];
      if (selectedCategory) setMarketplaceSelection(selectedCategory.id);
    };

    const setMarketplaceSelection = (id: string | null) => {
      const selectedCategory = categories.find((category) => category.id === id);
      fanMediaLayers.forEach((layer, layerId) => {
        gsap.set(layer, { autoAlpha: layerId === id ? 1 : 0 });
        layer.dataset.fanActive = String(layerId === id);
      });
      root.dataset.selectedMarketplaceId = id ?? "";
      if (fanSelectedLabel) fanSelectedLabel.textContent = selectedCategory?.title ?? "";
      const fanImage = id ? fanMediaImages.get(id) : null;
      if (fanImage) {
        fanImage.loading = "eager";
        fanImage.fetchPriority = "high";
      }
      if (process.env.NODE_ENV !== "production" && id) {
        const visible = Array.from(fanMediaLayers.entries()).filter(([, layer]) => {
          return Number(getComputedStyle(layer).opacity) > 0.5;
        });
        if (visible.length !== 1 || visible[0]?.[0] !== id) {
          console.error("[HomeDirector] Fan selection must activate exactly one marketplace image.", { id, visible: visible.map(([layerId]) => layerId) });
        }
      }
    };

    const syncNativeMarketplace = () => {
      if (!useNativeMarketRail || !marketRailWrapper || measuredCardStep <= 0) return;
      setMarketplaceActive(Math.round(marketRailWrapper.scrollLeft / measuredCardStep));
    };

    const applyActor = (name: ActorName, actor: ActorFrame, frame: HomeFrame) => {
      const slot = slotNodes.get(name);
      if (!slot) return;
      const actorType = ACTOR_TYPES[name];
      let displayedState = name === "van" && actor.state === "sliding-door-open" ? "side-left" : actor.state;
      let definition = ACTOR_STATES[actorType][displayedState];
      if (!definition) return;

      const layers = stateLayers.get(name);
      const isHeroSequence = name === "whiteTruck" && definition.family === "hero-sequence";
      if (isHeroSequence && layers) {
        const primaryLayer = layers.get(actor.state);
        const nextLayer = actor.blendToState ? layers.get(actor.blendToState) : undefined;
        requestActorImageDecode(primaryLayer, "high");
        if (actor.stateBlend && actor.stateBlend > 0) requestActorImageDecode(nextLayer);

        if (!isActorImageDecoded(primaryLayer)) {
          const fallbackState = lastLayerState.get(name);
          const fallbackLayer = fallbackState ? layers.get(fallbackState) : undefined;
          if (!isActorImageDecoded(fallbackLayer)) {
            gsap.set(slot, { autoAlpha: 0 });
            return;
          }
          displayedState = fallbackState!;
          definition = ACTOR_STATES[actorType][displayedState] ?? definition;
        }

        const activeLayer = layers.get(displayedState);
        const canBlend = displayedState === actor.state
          && Boolean(nextLayer && actor.stateBlend && actor.stateBlend > 0 && isActorImageDecoded(nextLayer));
        const blend = canBlend ? actor.stateBlend ?? 0 : 0;
        layers.forEach((layer, state) => {
          const alpha = state === displayedState
            ? 1 - blend
            : canBlend && state === actor.blendToState
              ? blend
              : 0;
          gsap.set(layer, { autoAlpha: alpha });
        });
        if (activeLayer) lastLayerState.set(name, displayedState);
      } else {
        const previousLayerState = lastLayerState.get(name);
        if (previousLayerState !== displayedState) {
          layers?.forEach((layer, state) => gsap.set(layer, { autoAlpha: state === displayedState ? 1 : 0 }));
          lastLayerState.set(name, displayedState);
        }
      }

      let width: number;
      let height: number;
      if (actor.sizeMode?.mode === "visible-height") {
        const visibleHeight = window.innerHeight * actor.sizeMode.visibleHeightVh / 100;
        height = visibleHeight / Math.max(0.01, definition.visibleBounds.height);
        width = height * definition.aspectRatio;
      } else {
        const widthVw = actor.sizeMode?.mode === "width" ? actor.sizeMode.widthVw : actor.widthVw;
        width = window.innerWidth * widthVw / 100;
        height = width / definition.aspectRatio;
      }
      const aligned = alignGroundContact({
        width,
        height,
        groundContact: definition.groundContact,
        target: { x: window.innerWidth * actor.targetX, y: window.innerHeight * actor.groundY - stageTopPx },
      });
      gsap.set(slot, {
        x: aligned.left,
        y: aligned.top,
        width,
        height,
        rotation: actor.rotation,
        scale: actor.scale,
        transformOrigin: "0 0",
        autoAlpha: actor.visible ? 1 : 0,
      });

      if (name === "van" && doorAperture) {
        const doorProgress = frame.chapter === "collection"
          ? range(frame.chapterProgress, HOME_BEATS.collection.door[0], HOME_BEATS.collection.door[1])
          : 0;
        const opening = VAN_DOOR_CALIBRATION.cargoOpeningRect.normalized;
        const top = interpolate(50, opening.y * 100, doorProgress);
        const right = interpolate(50, (1 - opening.x - opening.width) * 100, doorProgress);
        const bottom = interpolate(50, (1 - opening.y - opening.height) * 100, doorProgress);
        const left = interpolate(50, opening.x * 100, doorProgress);
        gsap.set(doorAperture, {
          autoAlpha: doorProgress > 0 || actor.state === "sliding-door-open" ? 1 : 0,
          clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)`,
        });
      }
    };

    const applyRouteGeometry = (frame: HomeFrame) => {
      if (frame.chapter !== "route" || !routePath || routePathLength <= 0) return;
      const svg = routePath.ownerSVGElement;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = rect.width / routePathViewBox.width;
      const scaleY = rect.height / routePathViewBox.height;
      const distance = routePathLength * frame.route.pathProgress;
      const point = routePath.getPointAtLength(distance);
      const ahead = routePath.getPointAtLength(Math.min(routePathLength, distance + 2));
      let deltaX = (ahead.x - point.x) * scaleX;
      let deltaY = (ahead.y - point.y) * scaleY;
      if (Math.abs(deltaX) + Math.abs(deltaY) < 0.01) {
        const behind = routePath.getPointAtLength(Math.max(0, distance - 2));
        deltaX = (point.x - behind.x) * scaleX;
        deltaY = (point.y - behind.y) * scaleY;
      }
      const tangent = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      frame.actors.whiteTruck.targetX = (rect.left + point.x * scaleX) / window.innerWidth;
      frame.actors.whiteTruck.groundY = (rect.top + point.y * scaleY) / window.innerHeight;
      frame.actors.whiteTruck.rotation = tangent;
      frame.route.tangentAngle = tangent;
      root.dataset.homeRouteProgress = frame.route.pathProgress.toFixed(3);
      root.dataset.homeRouteTangent = tangent.toFixed(1);
    };

    let activePhysicalOcclusion: string | null = null;
    const setPhysicalOcclusion = (frame: HomeFrame) => {
      const id = frame.occlusion.id;
      root.dataset.homeOcclusionCoverage = "—";
      if (activePhysicalOcclusion && activePhysicalOcclusion !== id) {
        const previous = physicalOccluders.get(activePhysicalOcclusion);
        if (previous) gsap.set(previous, { autoAlpha: 0 });
      }
      activePhysicalOcclusion = id;
      if (!id) return;
      const element = physicalOccluders.get(id);
      if (!element) return;
      const reportCoverage = (actorName: ActorName) => {
        const actorRect = slotNodes.get(actorName)?.getBoundingClientRect();
        if (actorRect) root.dataset.homeOcclusionCoverage = `${(physicalCoverage(actorRect, element.getBoundingClientRect()) * 100).toFixed(1)}%`;
      };
      if (id === "market-to-fan-card-mask" || id === "fan-parcel-mask") {
        root.dataset.homeOcclusionCoverage = "transfer plane";
        return;
      }

      if (id === "route-terminal-mask" || (id === "route-overpass-a" && frame.chapter === "custody")) {
        const progress = frame.occlusion.progress;
        gsap.set(element, {
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: Math.max(1, window.innerHeight - stageTopPx),
          clipPath: `inset(0 0 ${interpolate(100, 0, progress)}% 0)`,
          autoAlpha: 1,
        });
        reportCoverage("whiteTruck");
        return;
      }

      if (id === "custody-seam-mask" && frame.chapter === "collection") {
        const progress = frame.occlusion.progress;
        gsap.set(element, {
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: Math.max(1, window.innerHeight - stageTopPx),
          clipPath: `inset(0 0 0 ${interpolate(100, 0, progress)}%)`,
          autoAlpha: 1,
        });
        reportCoverage("van");
        return;
      }

      if (id === "arrival-architecture-mask" && frame.chapter === "arrival" && frame.chapterProgress >= HOME_BEATS.arrival.footerRelease[0]) {
        const progress = frame.occlusion.progress;
        gsap.set(element, {
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: window.innerHeight,
          background: "var(--kt-asphalt)",
          clipPath: `inset(${interpolate(100, 0, progress)}% 0 0 0)`,
          autoAlpha: 1,
        });
        reportCoverage("courier");
        return;
      }

      const actorName: ActorName = id === "parcel-mask" || id === "custody-seam-mask" || id === "arrival-architecture-mask"
        ? "courier"
        : id === "freight-gate-mask"
          ? "redTruck"
          : id === "van-door-mask" || id === "collection-viewport-edge"
            ? "van"
            : "whiteTruck";
      const slot = slotNodes.get(actorName);
      if (!slot) return;
      const rect = slot.getBoundingClientRect();
      gsap.set(element, {
        left: rect.left,
        top: rect.top - stageTopPx,
        width: rect.width,
        height: rect.height,
        clipPath: "inset(0)",
        autoAlpha: 1,
      });
      const coverageActor: ActorName = id === "parcel-mask" || id === "custody-seam-mask" || id === "arrival-architecture-mask"
        ? "courier"
        : id === "freight-gate-mask"
          ? "redTruck"
          : id === "van-door-mask" || id === "collection-viewport-edge"
            ? "van"
            : "whiteTruck";
      reportCoverage(coverageActor);
    };

    const applyFrame = (chapter: HomeChapter, progress: number) => {
      const effectiveProgress = prefersReducedMotion ? 0.5 : progress;
      const frame = resolveHomeFrame({ chapter, progress: effectiveProgress, viewportMode: window.innerWidth <= 767 ? "mobile" : "desktop", marketplaceCategories: categoryIds });
      applyRouteGeometry(frame);
      const previousFrame = lastFrame;
      if (process.env.NODE_ENV !== "production" && previousFrame
        && previousFrame.chapter === frame.chapter
        && Math.abs(previousFrame.chapterProgress - frame.chapterProgress) <= 0.05) {
        (Object.keys(ACTOR_TYPES) as ActorName[]).forEach((name) => {
          const previousActor = previousFrame.actors[name];
          const nextActor = frame.actors[name];
          if (previousActor.state !== nextActor.state && previousActor.visible && nextActor.visible) {
            try {
              assertActorTransition(ACTOR_TYPES[name], previousActor.state, nextActor.state, frame.occlusion.id);
            } catch (error) {
              console.error("[HomeDirector] Actor state transition is not declared.", {
                actor: name,
                previousState: previousActor.state,
                nextState: nextActor.state,
                occluderId: frame.occlusion.id,
                error,
              });
            }
          }
        });
      }
      lastFrame = frame;

      if (activeSelectionId !== frame.selection.marketplaceId) {
        activeSelectionId = frame.selection.marketplaceId;
        setMarketplaceSelection(activeSelectionId);
      }

      applyActor("whiteTruck", frame.actors.whiteTruck, frame);
      applyActor("van", frame.actors.van, frame);
      applyActor("courier", frame.actors.courier, frame);
      applyActor("redTruck", frame.actors.redTruck, frame);
      setPhysicalOcclusion(frame);

      if (process.env.NODE_ENV !== "production" && previousFrame
        && previousFrame.chapter === frame.chapter
        && Math.abs(previousFrame.chapterProgress - frame.chapterProgress) <= 0.05) {
        (Object.keys(ACTOR_TYPES) as ActorName[]).forEach((name) => {
          const previousActor = previousFrame.actors[name];
          const nextActor = frame.actors[name];
          const changedWhileExposed = previousActor.state !== nextActor.state && previousActor.visible && nextActor.visible;
          if (name === "whiteTruck" && isAdjacentHeroSequenceTransition(previousActor.state, nextActor.state)) return;
          const coveredRelease = previousActor.visible && !nextActor.visible;
          if (!changedWhileExposed && !coveredRelease) return;
          if (coveredRelease) {
            const actorRect = slotNodes.get(name)?.getBoundingClientRect();
            const fullyExited = actorRect && (
              actorRect.right <= 0 || actorRect.left >= window.innerWidth
              || actorRect.bottom <= stageTopPx || actorRect.top >= window.innerHeight
            );
            if (fullyExited) return;
          }
          const slot = slotNodes.get(name);
          const occluder = frame.occlusion.id ? physicalOccluders.get(frame.occlusion.id) : null;
          const measured = slot && occluder
            ? physicalCoverage(slot.getBoundingClientRect(), occluder.getBoundingClientRect())
            : 0;
          try {
            if (!slot || !occluder) throw new Error("The declared occluder is not rendered in this scene.");
            assertPhysicalCoverage({
              actorRect: slot.getBoundingClientRect(),
              occluderRect: occluder.getBoundingClientRect(),
              minimumCoverage: frame.occlusion.requiredCoverage || 0.85,
            });
          } catch (error) {
            console.error("[HomeDirector] Actor state changed without measured physical coverage.", {
              actor: name,
              previousState: previousActor.state,
              nextState: nextActor.state,
              previousVisible: previousActor.visible,
              nextVisible: nextActor.visible,
              occluderId: frame.occlusion.id,
              measuredCoverage: measured,
              error,
            });
          }
        });
      }

      const visibleVehicles = [frame.actors.whiteTruck, frame.actors.van, frame.actors.redTruck]
        .filter((actor) => actor.visible).length;
      if (process.env.NODE_ENV !== "production" && visibleVehicles > 1 && !frame.transition.owner) {
        console.error(`[HomeDirector] Multiple vehicle families visible in ${frame.chapter}.`);
      }
      if (frame.chapter === "finale" && Object.values(frame.actors).some((actor) => actor.visible)) {
        console.error("[HomeDirector] Finale cannot retain a visible actor.");
      }

      if (lastTone !== frame.headerTone) {
        lastTone = frame.headerTone;
        setHeaderTone(frame.headerTone);
        window.dispatchEvent(new CustomEvent("kt-header-tone", { detail: { tone: frame.headerTone } }));
      }

      if (marketRail && frame.chapter === "marketplace") {
        const step = measuredCardStep || window.innerWidth * 0.745;
        gsap.set(marketRail, { x: useNativeMarketRail ? 0 : -frame.marketplace.positionIndex * step });
        if (useNativeMarketRail) syncNativeMarketplace();
        else setMarketplaceActive(frame.marketplace.activeIndex);
      }

      if (chapter === "fan") {
        if (effectiveProgress >= 0.92 && !fanTransferGeometry && fanHeroCard && prepParcelTarget) {
          gsap.set(fanHeroCard, { x: 0, y: 0, rotation: 0, scale: 0.87, transformOrigin: "50% 50%", autoAlpha: 1 });
          const source = fanHeroCard.getBoundingClientRect();
          const target = prepParcelTarget.getBoundingClientRect();
          fanTransferGeometry = {
            source: { left: source.left, top: source.top, width: source.width, height: source.height },
            targetDocument: {
              left: target.left + window.scrollX,
              top: target.top + window.scrollY,
              width: target.width,
              height: target.height,
            },
          };
        }
        applyFanMotion(cards, effectiveProgress, fanTransferGeometry);
      }

      if (chapter === "custody" && custodyLeft && custodyRight) {
        const p = effectiveProgress;
        const leftWidth = p < 0.38
          ? interpolate(60, 50, range(p, 0.18, 0.38))
          : p < 0.56
            ? 50
            : interpolate(50, 30, range(p, 0.56, 0.72));
        gsap.set(custodyLeft, { width: `${leftWidth}%` });
        gsap.set(custodyRight, { width: `${100 - leftWidth}%` });
        if (custodyConcealment) gsap.set(custodyConcealment, { autoAlpha: range(p, 0.72, 0.86) });
      }

      if (finaleRoad) gsap.set(finaleRoad, {
        x: chapter === "finale" ? interpolate(-80, 0, effectiveProgress) : 0,
        autoAlpha: chapter === "finale" ? range(effectiveProgress, 0.58, 0.75) : 0,
      });
      if (heroKt && chapter === "hero") {
        gsap.set(heroKt, {
          y: prefersReducedMotion ? 0 : interpolate(0, -14, range(effectiveProgress, HOME_BEATS.hero.centreSettle[0], HOME_BEATS.hero.cameraPass[1])),
          autoAlpha: prefersReducedMotion ? 1 : interpolate(1, 0.3, range(effectiveProgress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1])),
        });
      }
      if (heroCourier && chapter === "hero") {
        gsap.set(heroCourier, {
          y: prefersReducedMotion ? 0 : interpolate(0, 10, range(effectiveProgress, HOME_BEATS.hero.centreSettle[0], HOME_BEATS.hero.cameraPass[1])),
          autoAlpha: prefersReducedMotion ? 1 : interpolate(1, 0.34, range(effectiveProgress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1])),
        });
      }
      if (heroRoad && chapter === "hero") {
        gsap.set(heroRoad, {
          autoAlpha: prefersReducedMotion ? 0 : 0.24 * range(effectiveProgress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1]),
        });
      }
      if (heroActions && chapter === "hero") {
        const hero = HOME_BEATS.hero;
        const alpha = prefersReducedMotion
          ? 1
          : 1 - range(effectiveProgress, hero.entryReveal[0], hero.entryReveal[1]);
        gsap.set(heroActions, { autoAlpha: alpha, y: prefersReducedMotion ? 0 : interpolate(0, -10, range(effectiveProgress, hero.entryReveal[0], hero.entryReveal[1])) });
      }
      if (prepCollectionIncoming) {
        gsap.set(prepCollectionIncoming, {
          autoAlpha: chapter === "preparation" ? range(effectiveProgress, HOME_BEATS.preparation.collectionUnderlay[0], HOME_BEATS.preparation.collectionUnderlay[1]) : 0,
        });
      }
      if (arrivalFooterTitle) {
        const release = chapter === "arrival" ? range(effectiveProgress, HOME_BEATS.arrival.footerRelease[0], HOME_BEATS.arrival.footerRelease[1]) : 0;
        gsap.set(arrivalFooterTitle, {
          autoAlpha: chapter === "arrival" ? range(effectiveProgress, 0.94, 0.985) : 0,
          y: chapter === "arrival" ? interpolate(34, 0, smooth(release)) : 0,
        });
      }
      if (finaleTitle) gsap.set(finaleTitle, { autoAlpha: chapter === "finale" ? 1 : 0 });
      if (finaleUtility) gsap.set(finaleUtility, { autoAlpha: chapter === "finale" ? range(effectiveProgress, 0.2, 0.48) : 0 });
      if (finaleLegal) gsap.set(finaleLegal, { autoAlpha: chapter === "finale" ? range(effectiveProgress, 0.48, 0.72) : 0 });

      root.dataset.homeChapter = frame.chapter;
      root.dataset.homeProgress = frame.chapterProgress.toFixed(3);
      root.dataset.homeOcclusion = frame.occlusion.id ?? "";
      root.dataset.homeWorldOwner = frame.world.owner;
      root.dataset.homeSelectedMarketplaceId = frame.selection.marketplaceId ?? "";
      root.dataset.homeFocus = frame.world.focus;
      root.dataset.homeRouteProgress = frame.route.pathProgress.toFixed(3);
      root.dataset.homeRouteTangent = frame.route.tangentAngle.toFixed(1);
      if (debugPanel && debugEnabled) {
        debugPanel.textContent = `${formatHomeDebugFrame(frame)}\nmeasured coverage: ${root.dataset.homeOcclusionCoverage ?? "—"}`;
      }
      return frame;
    };

    const measureRanges = () => {
      ranges.length = 0;
      sections.forEach(({ chapter, section }) => {
        const rect = section.getBoundingClientRect();
        const start = rect.top + window.scrollY;
        const end = start + Math.max(1, rect.height);
        const stickyStage = section.querySelector<HTMLElement>("[data-home-sticky-stage], .kt-home-sticky-stage, [data-marketplace-sticky-stage]");
        const isSticky = Boolean(stickyStage && getComputedStyle(stickyStage).position === "sticky");
        const scrollSpan = isSticky ? rect.height - window.innerHeight : rect.height;
        ranges.push({ chapter, section, start, end, progressEnd: start + Math.max(1, scrollSpan) });
      });
      stageTopPx = actorStage?.getBoundingClientRect().top ?? 0;
      fanTransferGeometry = null;
      const firstCard = marketCards[0];
      if (firstCard) {
        const cardStyle = window.getComputedStyle(firstCard);
        measuredCardStep = firstCard.getBoundingClientRect().width + Number.parseFloat(cardStyle.marginRight || "0");
      }
      if (routePath) {
        routePathLength = routePath.getTotalLength();
        const viewBox = routePath.ownerSVGElement?.viewBox.baseVal;
        if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
          routePathViewBox = { width: viewBox.width, height: viewBox.height };
        }
      }
    };

    const rangeForScroll = (scrollY: number): { chapter: HomeChapter; progress: number } => {
      const current = ranges.find((item) => scrollY >= item.start && scrollY < item.end)
        ?? (scrollY < (ranges[0]?.start ?? 0) ? ranges[0] : ranges[ranges.length - 1]);
      if (!current) return { chapter: "hero", progress: 0 };
      return {
        chapter: current.chapter,
        progress: clamp01((scrollY - current.start) / (current.progressEnd - current.start)),
      };
    };

    const preloadChapter = (chapter: HomeChapter) => {
      const preload = PRELOAD_STATES[chapter];
      Object.entries(preload).forEach(([actorName, states]) => {
        const layers = stateLayers.get(actorName as ActorName);
        states?.forEach((state) => {
          const image = layers?.get(state);
          if (!image) return;
          image.loading = "eager";
          image.fetchPriority = "high";
        });
      });
    };

    const preloadFrame = (frame: HomeFrame) => {
      Object.entries(frame.actors).forEach(([name, actor]) => {
        if (!actor.visible) return;
        const state = name === "van" && actor.state === "sliding-door-open" ? "side-left" : actor.state;
        const layers = stateLayers.get(name as ActorName);
        requestActorImageDecode(layers?.get(state), "high");
        if (!prefersReducedMotion && actor.blendToState) requestActorImageDecode(layers?.get(actor.blendToState));
      });
    };

    const preloadRemainingHeroSequence = () => {
      const layers = stateLayers.get("whiteTruck");
      HERO_TRUCK_SEQUENCE.slice(6).forEach((state) => requestActorImageDecode(layers?.get(state)));
    };

    const preloadFanSelection = (index = categories.length - 1) => {
      const safeIndex = Math.max(0, Math.min(categories.length - 1, index));
      const selectedCategory = categories[safeIndex];
      const image = selectedCategory ? fanMediaImages.get(selectedCategory.id) : null;
      if (!image) return;
      image.loading = "eager";
      image.fetchPriority = "high";
    };

    const seekFromScroll = (scrollY = window.scrollY) => {
      const { chapter, progress } = rangeForScroll(scrollY);
      const nextChapterIndex = HOME_CHAPTERS.indexOf(chapter) + 1;
      if (progress >= 0.72 && nextChapterIndex < HOME_CHAPTERS.length) {
        preloadChapter(HOME_CHAPTERS[nextChapterIndex]);
      }
      const frame = resolveHomeFrame({ chapter, progress, viewportMode: window.innerWidth <= 767 ? "mobile" : "desktop", marketplaceCategories: categoryIds });
      if ((chapter === "marketplace" && progress >= 0.68) || chapter === "fan") {
        preloadFanSelection(chapter === "marketplace" ? frame.marketplace.activeIndex : categories.length - 1);
      }
      preloadFrame(frame);
      const normalizedProgress = prefersReducedMotion ? 0.5 : progress;
      timelines.get(chapter)?.timeline.progress(normalizedProgress);
      // A chapter timeline does not emit onUpdate when revisiting the same
      // progress value after another chapter has taken ownership. Reapply the
      // deterministic frame so reverse scrolling reconstructs that exact view.
      if (root.dataset.homeChapter !== chapter) applyFrame(chapter, normalizedProgress);
      return frame;
    };

    let scrollFrame = 0;
    const syncFrameFromWindowScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        seekFromScroll(window.scrollY);
      });
    };
    refreshFrameAfterDecode = () => seekFromScroll(window.scrollY);

    try {
      if (process.env.NODE_ENV !== "production") validateHomeActorTransitions();
    } catch (error) {
      console.error(error);
    }

    if (actorStage) gsap.set(actorStage, { autoAlpha: 0 });

    HOME_CHAPTERS.forEach((chapter) => {
      const timeline = createNormalizedTimeline((progress) => applyFrame(chapter, progress));
      timelines.set(chapter, timeline);
    });

    measureRanges();
    if (useNativeMarketRail) setMarketplaceActive(0);
    const initialPosition = rangeForScroll(window.scrollY);
    const initialFrame = resolveHomeFrame({
      chapter: initialPosition.chapter,
      progress: prefersReducedMotion ? 0.5 : initialPosition.progress,
      viewportMode: window.innerWidth <= 767 ? "mobile" : "desktop",
      marketplaceCategories: categoryIds,
    });
    preloadChapter(initialPosition.chapter);
    preloadFrame(initialFrame);
    if (initialPosition.chapter === "fan") preloadFanSelection(categories.length - 1);

    const revealAfterLayout = async () => {
      await document.fonts?.ready;
      const { chapter, progress } = rangeForScroll(window.scrollY);
      preloadChapter(chapter);
      const currentFrame = resolveHomeFrame({ chapter, progress, viewportMode: window.innerWidth <= 767 ? "mobile" : "desktop", marketplaceCategories: categoryIds });
      preloadFrame(currentFrame);
      const chapterSection = ranges.find((item) => item.chapter === chapter)?.section;
      const currentChapterImages = Array.from(chapterSection?.querySelectorAll<HTMLImageElement>("img") ?? [])
        .filter((image) => image.loading === "eager");
      const eagerActorImages = Array.from(stateLayers.values())
        .flatMap((layers) => Array.from(layers.values()))
        .filter((image) => image.loading === "eager");
      await Promise.all(
        [...new Set([...eagerActorImages, ...currentChapterImages])]
          .map(async (image) => {
            try {
              await image.decode?.();
              if (image.hasAttribute("data-actor-state-layer")) {
                decodedActorImages.add(image);
                image.dataset.actorStateDecoded = "true";
              }
            } catch {
              // A failed predecode never authorizes an empty actor frame.
            }
          }),
      );
      ScrollTrigger.refresh();
      measureRanges();
      const frame = seekFromScroll(window.scrollY);
      applyFrame(frame.chapter, frame.chapterProgress);
      if (actorStage) gsap.set(actorStage, { autoAlpha: 1 });
      if (!isInitialized) {
        isInitialized = true;
        lastFrame = frame;
      }
      if (!prefersReducedMotion) preloadRemainingHeroSequence();
    };

    const resizeDirector = () => {
      const frozen = lastFrame;
      if (actorStage) actorStage.dataset.resizing = "true";
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        useNativeMarketRail = window.matchMedia("(max-width: 899px)").matches;
        ScrollTrigger.refresh();
        measureRanges();
        if (frozen) {
          const target = ranges.find((item) => item.chapter === frozen.chapter);
          if (target) {
            const targetY = target.start + frozen.chapterProgress * (target.progressEnd - target.start);
            window.scrollTo(0, targetY);
          }
        }
        seekFromScroll(window.scrollY);
        syncNativeMarketplace();
        if (actorStage) delete actorStage.dataset.resizing;
      }, 140);
    };

    const trigger = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      invalidateOnRefresh: true,
    });
    window.addEventListener("scroll", syncFrameFromWindowScroll, { passive: true });
    window.addEventListener("resize", resizeDirector, { passive: true });
    marketRailWrapper?.addEventListener("scroll", syncNativeMarketplace, { passive: true });
    const context = gsap.context(() => {}, root);
    void revealAfterLayout();

    return () => {
      window.clearTimeout(resizeTimer);
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", syncFrameFromWindowScroll);
      window.removeEventListener("resize", resizeDirector);
      marketRailWrapper?.removeEventListener("scroll", syncNativeMarketplace);
      trigger.kill();
      context.revert();
      timelines.forEach(({ timeline }) => timeline.kill());
    };
  }, [rootRef, categories, enabled, prefersReducedMotion, setHeaderTone]);
}
