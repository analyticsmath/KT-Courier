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
  type ActorStateDefinition,
} from "../../actors/actor-state-machine";
import type { HomeChapter } from "./home-chapters";
import { HOME_CHAPTERS } from "./home-chapters";
import { clamp01, HOME_BEATS, range } from "./home-beats";
import { formatHomeDebugFrame } from "./home-debug";
import { alignGroundContact } from "./home-grounding";
import {
  assertActorTransition,
  validateHomeActorTransitions,
  type ActorType,
} from "./home-actor-transitions";
import { resolveHomeFrame, type ActorFrame, type HomeFrame } from "./home-frame-resolver";
import type { HomepageCategoryVisual } from "./home-category-media";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

type ActorName = "whiteTruck" | "van" | "courier" | "redTruck";
type ActorSlotName = "white-truck" | "van" | "courier" | "red-truck";
type SceneRange = { chapter: HomeChapter; section: HTMLElement; start: number; end: number };
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
  hero: { whiteTruck: ["side-right", "wide-hero", "cargo-box-close"] },
  marketplace: {},
  fan: {},
  preparation: {},
  collection: {
    van: ["motion-transition", "side-left", "sliding-door-open"],
    courier: ["look-left-approach", "lift-parcel", "loading-unloading"],
  },
  custody: { courier: ["loading-unloading", "ready-handover"] },
  route: { whiteTruck: ["top-down-straight", "top-down-angled", "top-down-turning"] },
  freight: { redTruck: ["motion-entry", "side-right", "centered-hero"] },
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

function applyFanMotion(cards: HTMLElement[], progress: number, transfer?: FanTransferGeometry | null): void {
  const p = clamp01(progress);
  const spread = range(p, 0.12, 0.32);
  const compress = range(p, 0.5, 0.68);
  const contract = range(p, 0.8, 0.92);
  const parcel = range(p, 0.92, 1);

  cards.forEach((card) => {
    const isHero = card.dataset.isHero === "true";
    gsap.set(card, { transformOrigin: "bottom center" });
    const baseX = Number(card.dataset.fanX ?? 0);
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
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  categories: HomepageCategoryVisual[];
}): void {
  const { prefersReducedMotion, setHeaderTone } = useMotionContext();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const actorStage = root.querySelector<HTMLElement>("[data-kt-actor-stage]");
    const directorOccluder = root.querySelector<HTMLElement>("[data-kt-home-occluder]");
    const takeover = root.querySelector<HTMLElement>("[data-motion='trailer-takeover']");
    const debugPanel = root.querySelector<HTMLElement>("[data-kt-motion-debug]");
    const debugEnabled = process.env.NODE_ENV !== "production"
      && new URLSearchParams(window.location.search).get("ktMotionDebug") === "1";
    if (debugPanel) debugPanel.hidden = !debugEnabled;

    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-kt-scene]"))
      .map((section) => ({ section, chapter: chapterFromSection(section) }))
      .filter((item): item is { section: HTMLElement; chapter: HomeChapter } => item.chapter !== null)
      .sort((a, b) => HOME_CHAPTERS.indexOf(a.chapter) - HOME_CHAPTERS.indexOf(b.chapter));
    const slotNodes = new Map<ActorName, HTMLElement>();
    const stateLayers = new Map<ActorName, Map<string, HTMLImageElement>>();
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
      const image = layer.querySelector<HTMLImageElement>("[data-fan-selected-image]");
      if (image) fanMediaImages.set(id, image);
    });
    const marketCards = Array.from(root.querySelectorAll<HTMLElement>("[data-marketplace-panel-id]"));
    const marketRail = root.querySelector<HTMLElement>("[data-motion='market-rail']");
    const marketRailWrapper = root.querySelector<HTMLElement>("[data-marketplace-rail-wrapper]");
    const marketWord = root.querySelector<HTMLElement>("[data-motion='market-word']");
    const doorAperture = root.querySelector<HTMLElement>("[data-van-door-aperture]");
    const routeOccluder = root.querySelector<HTMLElement>("[data-motion='route-occluder']");
    const routeOverlap = root.querySelector<HTMLElement>(".kt-route-freight-overlap");
    const custodyLeft = root.querySelector<HTMLElement>(".kt-custody-left");
    const custodyRight = root.querySelector<HTMLElement>(".kt-custody-right");
    const custodyConcealment = root.querySelector<HTMLElement>(".kt-custody-route-concealment");
    const finaleRoad = root.querySelector<HTMLElement>("[data-motion='finale-road']");
    const heroKt = root.querySelector<HTMLElement>("[data-motion='hero-kt']");
    const heroCourier = root.querySelector<HTMLElement>("[data-motion='hero-courier']");
    const heroActions = root.querySelector<HTMLElement>("[data-motion='hero-actions']");
    const cargoAnchor = root.querySelector<HTMLElement>("[data-actor-material-anchor='white-truck-cargo-box']");
    const transitionOne = takeover?.querySelector<HTMLElement>(".takeover-progression-1");
    const transitionThree = takeover?.querySelector<HTMLElement>(".takeover-progression-3");
    const transitionFive = takeover?.querySelector<HTMLElement>(".takeover-progression-5");
    const panelsThree = Array.from(takeover?.querySelectorAll<HTMLElement>("[data-takeover-p3-panel]") ?? []);
    const panelsFive = Array.from(takeover?.querySelectorAll<HTMLElement>("[data-takeover-p5-panel]") ?? []);

    const categoryIds = categories.map(({ id }) => ({ id }));
    const ranges: SceneRange[] = [];
    const timelines = new Map<HomeChapter, ProgressTimeline>();
    const lastLayerState = new Map<ActorName, string>();
    let lastMarketplaceIndex = -1;
    let useNativeMarketRail = window.matchMedia("(max-width: 899px)").matches;
    let lastTone: HomeFrame["headerTone"] | null = null;
    let lastFrame: HomeFrame | null = null;
    let measuredCardStep = 0;
    let stageTopPx = actorStage?.getBoundingClientRect().top ?? 0;
    let measuredCargoRect: DOMRect | null = null;
    let fanTransferGeometry: FanTransferGeometry | null = null;
    let resizeTimer = 0;
    let isInitialized = false;

    const setTransitionLayer = (
      frame: HomeFrame,
      activeTransitionProgress: number,
    ) => {
      if (!takeover) return;
      const active = frame.chapter === "hero" && frame.transition.owner !== null
        && frame.chapterProgress >= 0.82;
      if (!active) {
        gsap.set(takeover, { autoAlpha: 0, clipPath: "inset(0 0 0 0)" });
        return;
      }

      if (frame.transition.owner === "hero-cargo-takeover" && cargoAnchor) {
        const rect = measuredCargoRect ?? cargoAnchor.getBoundingClientRect();
        measuredCargoRect = rect;
        const p = activeTransitionProgress;
        const lerpInset = (edge: number) => edge * (1 - p);
        const top = Math.max(0, rect.top);
        const right = Math.max(0, window.innerWidth - rect.right);
        const bottom = Math.max(0, window.innerHeight - rect.bottom);
        const left = Math.max(0, rect.left);
        gsap.set(takeover, {
          autoAlpha: 1,
          clipPath: `inset(${lerpInset(top)}px ${lerpInset(right)}px ${lerpInset(bottom)}px ${lerpInset(left)}px)`,
        });
      } else {
        gsap.set(takeover, { autoAlpha: 1, clipPath: "inset(0 0 0 0)" });
      }

      const hero = frame.chapterProgress;
      if (transitionOne) gsap.set(transitionOne, { autoAlpha: hero < 0.94 ? 1 : 0 });
      if (transitionThree) gsap.set(transitionThree, { autoAlpha: hero >= 0.88 && hero < 0.98 ? 1 : 0 });
      if (transitionFive) gsap.set(transitionFive, { autoAlpha: hero >= 0.94 ? 1 : 0 });

      const threeProgress = range(hero, 0.88, 0.94);
      panelsThree.forEach((panel, index) => {
        const count = Math.max(1, panelsThree.length);
        const target = 100 / count;
        const start = index === Math.floor(count / 2) ? 100 : 0;
        gsap.set(panel, { width: `${interpolate(start, target, threeProgress)}%` });
      });

      const fiveProgress = range(hero, 0.94, 0.98);
      panelsFive.forEach((panel, index) => {
        const count = Math.max(1, panelsFive.length);
        const target = 100 / count;
        const start = index === 1 || index === 3 ? 50 : 0;
        gsap.set(panel, { width: `${interpolate(start, target, fiveProgress)}%` });
      });
    };

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
      if (selectedCategory) {
        fanMediaLayers.forEach((layer, id) => gsap.set(layer, { autoAlpha: id === selectedCategory.id ? 1 : 0 }));
        const fanImage = fanMediaImages.get(selectedCategory.id);
        if (fanImage) {
          fanImage.loading = "eager";
          fanImage.fetchPriority = "high";
        }
        if (fanSelectedLabel) fanSelectedLabel.textContent = selectedCategory.title;
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
      const displayedState = name === "van" && actor.state === "sliding-door-open" ? "side-left" : actor.state;
      const definition = ACTOR_STATES[actorType][displayedState];
      if (!definition) return;

      const previousLayerState = lastLayerState.get(name);
      if (previousLayerState !== displayedState) {
        const layers = stateLayers.get(name);
        layers?.forEach((layer, state) => gsap.set(layer, { autoAlpha: state === displayedState ? 1 : 0 }));
        lastLayerState.set(name, displayedState);
      }

      const width = window.innerWidth * actor.widthVw / 100;
      const height = width / definition.aspectRatio;
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
          ? range(frame.chapterProgress, 0.52, 0.68)
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

    const applyFrame = (chapter: HomeChapter, progress: number) => {
      const effectiveProgress = prefersReducedMotion ? 0.5 : progress;
      const frame = resolveHomeFrame({ chapter, progress: effectiveProgress, marketplaceCategories: categoryIds });
      const previousFrame = lastFrame;
      if (process.env.NODE_ENV !== "production" && previousFrame
        && previousFrame.chapter === frame.chapter
        && Math.abs(previousFrame.chapterProgress - frame.chapterProgress) <= 0.05) {
        (Object.keys(ACTOR_TYPES) as ActorName[]).forEach((name) => {
          const previousActor = previousFrame.actors[name];
          const nextActor = frame.actors[name];
          if (previousActor.state !== nextActor.state && (previousActor.visible || nextActor.visible)) {
            try {
              assertActorTransition(ACTOR_TYPES[name], previousActor.state, nextActor.state, frame.transition.occlusion);
            } catch (error) {
              console.error(error);
            }
          }
        });
      }
      if (previousFrame?.transition.owner !== "hero-cargo-takeover" && frame.transition.owner === "hero-cargo-takeover") {
        measuredCargoRect = null;
      }
      if (frame.transition.owner !== "hero-cargo-takeover") measuredCargoRect = null;
      lastFrame = frame;

      applyActor("whiteTruck", frame.actors.whiteTruck, frame);
      applyActor("van", frame.actors.van, frame);
      applyActor("courier", frame.actors.courier, frame);
      applyActor("redTruck", frame.actors.redTruck, frame);

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
        const leftWidth = p < 0.4
          ? interpolate(72, 50, range(p, 0.18, 0.4))
          : p < 0.54
            ? 50
            : interpolate(50, 24, range(p, 0.54, 0.74));
        gsap.set(custodyLeft, { width: `${leftWidth}%` });
        gsap.set(custodyRight, { width: `${100 - leftWidth}%` });
        if (custodyConcealment) gsap.set(custodyConcealment, { autoAlpha: range(p, 0.74, 1) });
      }

      if (routeOccluder) {
        const routeP = chapter === "route" ? effectiveProgress : -1;
        const first = routeP >= 0.54 && routeP < 0.64 ? Math.sin(Math.PI * range(routeP, 0.54, 0.64)) : 0;
        const second = routeP >= 0.78 && routeP < 0.88 ? Math.sin(Math.PI * range(routeP, 0.78, 0.88)) : 0;
        gsap.set(routeOccluder, { autoAlpha: Math.max(first, second), y: interpolate(-80, 80, routeP < 0.64 ? range(routeP, 0.54, 0.64) : range(routeP, 0.78, 0.88)) });
      }
      if (routeOverlap) {
        gsap.set(routeOverlap, { autoAlpha: chapter === "route" ? range(effectiveProgress, 0.94, HOME_BEATS.route.truckRelease) : chapter === "freight" ? 1 : 0 });
      }
      if (finaleRoad) gsap.set(finaleRoad, { x: chapter === "finale" ? interpolate(-80, 0, effectiveProgress) : 0 });
      if (heroKt && chapter === "hero") gsap.set(heroKt, { y: interpolate(0, -18, range(effectiveProgress, 0.59, 0.82)) });
      if (heroCourier && chapter === "hero") gsap.set(heroCourier, { y: interpolate(0, -12, range(effectiveProgress, 0.59, 0.82)) });
      if (heroActions && chapter === "hero") gsap.set(heroActions, { autoAlpha: effectiveProgress >= 0.36 ? 1 : range(effectiveProgress, 0.23, 0.36) });

      if (directorOccluder) {
        const occlusion = frame.transition.occlusion;
        if (occlusion === "overpass-shadow") {
          gsap.set(directorOccluder, { autoAlpha: 1, left: 0, top: "42%", width: "100%", height: "25%", clipPath: "inset(0)", background: "linear-gradient(180deg, transparent, rgba(8,10,12,.98) 30%, rgba(8,10,12,.98) 70%, transparent)" });
        } else if (occlusion === "architectural-mask") {
          gsap.set(directorOccluder, { autoAlpha: 1, left: `${interpolate(34, 64, frame.transition.progress)}%`, top: "18%", width: "38%", height: "72%", clipPath: "inset(0)", background: "var(--kt-freight-paper)" });
        } else if (occlusion === "viewport-edge") {
          gsap.set(directorOccluder, { autoAlpha: 1, left: 0, top: 0, width: "38%", height: "100%", clipPath: "inset(0)", background: "linear-gradient(90deg, rgba(11,13,15,.94), transparent)" });
        } else if (occlusion === "road-geometry" && chapter === "route") {
          gsap.set(directorOccluder, {
            autoAlpha: 1,
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            clipPath: `inset(${interpolate(100, 0, frame.transition.progress)}% 0 0 0)`,
            background: "linear-gradient(180deg, var(--kt-asphalt), #151a1e 55%, var(--kt-asphalt))",
          });
        } else if (occlusion === "scene-boundary" && chapter === "freight") {
          gsap.set(directorOccluder, { autoAlpha: 1, left: 0, top: "50%", width: "100%", height: "50%", clipPath: "inset(0)", background: "linear-gradient(180deg, transparent, var(--kt-asphalt))" });
        } else {
          gsap.set(directorOccluder, { autoAlpha: 0, clipPath: "inset(0)" });
        }
      }

      setTransitionLayer(frame, frame.transition.progress);
      root.dataset.homeChapter = frame.chapter;
      root.dataset.homeProgress = frame.chapterProgress.toFixed(3);
      root.dataset.homeOcclusion = frame.transition.occlusion ?? "";
      if (debugPanel && debugEnabled) debugPanel.textContent = formatHomeDebugFrame(frame);
      return frame;
    };

    const measureRanges = () => {
      ranges.length = 0;
      sections.forEach(({ chapter, section }) => {
        const rect = section.getBoundingClientRect();
        const start = rect.top + window.scrollY;
        ranges.push({ chapter, section, start, end: start + Math.max(1, rect.height) });
      });
      stageTopPx = actorStage?.getBoundingClientRect().top ?? 0;
      measuredCargoRect = null;
      fanTransferGeometry = null;
      const firstCard = marketCards[0];
      if (firstCard) {
        const cardStyle = window.getComputedStyle(firstCard);
        measuredCardStep = firstCard.getBoundingClientRect().width + Number.parseFloat(cardStyle.marginRight || "0");
      }
    };

    const rangeForScroll = (scrollY: number): { chapter: HomeChapter; progress: number } => {
      const current = ranges.find((item) => scrollY >= item.start && scrollY < item.end)
        ?? (scrollY < (ranges[0]?.start ?? 0) ? ranges[0] : ranges[ranges.length - 1]);
      if (!current) return { chapter: "hero", progress: 0 };
      return {
        chapter: current.chapter,
        progress: clamp01((scrollY - current.start) / (current.end - current.start)),
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
        const image = stateLayers.get(name as ActorName)?.get(state);
        if (image) {
          image.loading = "eager";
          image.fetchPriority = "high";
        }
      });
    };

    const preloadFanSelection = (index = lastMarketplaceIndex) => {
      const safeIndex = index >= 0
        ? Math.min(categories.length - 1, index)
        : useNativeMarketRail ? 0 : categories.length - 1;
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
      const frame = resolveHomeFrame({ chapter, progress, marketplaceCategories: categoryIds });
      if ((chapter === "marketplace" && progress >= 0.68) || chapter === "fan") {
        preloadFanSelection(chapter === "marketplace" ? frame.marketplace.activeIndex : lastMarketplaceIndex);
      }
      preloadFrame(frame);
      timelines.get(chapter)?.timeline.progress(prefersReducedMotion ? 0.5 : progress);
      return frame;
    };

    try {
      if (process.env.NODE_ENV !== "production") validateHomeActorTransitions();
    } catch (error) {
      console.error(error);
    }

    if (actorStage) gsap.set(actorStage, { autoAlpha: 0 });
    if (takeover) gsap.set(takeover, { autoAlpha: 0 });

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
      marketplaceCategories: categoryIds,
    });
    preloadChapter(initialPosition.chapter);
    preloadFrame(initialFrame);
    if (initialPosition.chapter === "fan") preloadFanSelection();

    const revealAfterLayout = async () => {
      await document.fonts?.ready;
      const { chapter, progress } = rangeForScroll(window.scrollY);
      preloadChapter(chapter);
      const currentFrame = resolveHomeFrame({ chapter, progress, marketplaceCategories: categoryIds });
      preloadFrame(currentFrame);
      const chapterSection = ranges.find((item) => item.chapter === chapter)?.section;
      const currentChapterImages = Array.from(chapterSection?.querySelectorAll<HTMLImageElement>("img") ?? [])
        .filter((image) => image.loading === "eager");
      const eagerActorImages = Array.from(stateLayers.values())
        .flatMap((layers) => Array.from(layers.values()))
        .filter((image) => image.loading === "eager");
      await Promise.all(
        [...new Set([...eagerActorImages, ...currentChapterImages])]
          .map((image) => image.decode?.().catch(() => undefined)),
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
            const targetY = target.start + frozen.chapterProgress * (target.end - target.start);
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
      onUpdate: () => seekFromScroll(window.scrollY),
    });
    window.addEventListener("resize", resizeDirector, { passive: true });
    marketRailWrapper?.addEventListener("scroll", syncNativeMarketplace, { passive: true });
    const context = gsap.context(() => {}, root);
    void revealAfterLayout();

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", resizeDirector);
      marketRailWrapper?.removeEventListener("scroll", syncNativeMarketplace);
      trigger.kill();
      context.revert();
      timelines.forEach(({ timeline }) => timeline.kill());
    };
  }, [rootRef, categories, prefersReducedMotion, setHeaderTone]);
}
