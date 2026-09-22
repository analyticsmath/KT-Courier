"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionContext } from "../../motion/PublicMotionProvider";
import { WHITE_TRUCK_STATES } from "../../actors/actor-state-machine";
import { alignGroundContact } from "./home-grounding";
import { closestReadyHeroSequenceState, isActorImageReady } from "./home-actor-image-readiness";
import { deriveHeroActorPresentation } from "./hero-actor-presentation";
import { resolveHeroTruckFrame } from "./home-frame-resolver";
import { clamp01, getCommerceBeats, HOME_BEATS, range } from "./home-beats";
import { HOME_CHAPTERS, HOME_MOBILE_POLICY, reducedMotionChapterProgress, type HomeChapter, type PostHeroChapter } from "./home-chapters";
import { marketplaceTrackX } from "./home-marketplace-geometry";
import { commitSelection } from "./home-selection";
import { resolvePostHeroFrame, type PostHeroActorKey, type PostHeroActorName, type PostHeroActorPose, type PostHeroFrame } from "./post-hero-frame-resolver";
import { computePostHeroActorBox } from "./post-hero-actor-geometry";
import { isPostHeroActorReady, markPostHeroActorReady, POST_HERO_ACTOR_ASSETS, postHeroActorsForChapter, preloadPostHeroActor, preloadPostHeroActorsForChapter } from "../actors/post-hero-actor-preload";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

type SceneRange = { chapter: HomeChapter; section: HTMLElement; start: number; end: number; progressEnd: number };

function chapterFromSection(section: HTMLElement): HomeChapter | null {
  const name = section.dataset.ktScene as HomeChapter | undefined;
  return name && HOME_CHAPTERS.includes(name) ? name : null;
}

function homeHeaderTone(chapter: HomeChapter): "light" | "dark" {
  return ["commerce", "freight", "finale"].includes(chapter) ? "dark" : "light";
}

export function useHomeNarrativeDirector({
  rootRef,
  categories,
  stores = [],
  products = [],
  enabled,
  onMarketplaceSelectionChange,
  onStoreSelectionChange,
  onProductSelectionChange,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  categories: readonly { id: string }[];
  stores?: readonly { id: string }[];
  products?: readonly { id: string }[];
  enabled: boolean;
  onMarketplaceSelectionChange?: (id: string) => void;
  onStoreSelectionChange?: (id: string) => void;
  onProductSelectionChange?: (id: string) => void;
}): void {
  const { prefersReducedMotion, setHeaderTone } = useMotionContext();

  useEffect(() => {
    if (!enabled || !rootRef.current) return;
    const root = rootRef.current;
    const sceneRanges: SceneRange[] = [];
    const stage = root.querySelector<HTMLElement>("[data-kt-actor-stage]");
    const heroSlot = stage?.querySelector<HTMLElement>("[data-actor-slot='white-truck']");
    const heroLayers = new Map<string, HTMLImageElement>();
    heroSlot?.querySelectorAll<HTMLImageElement>("[data-actor-state-layer]").forEach((image) => {
      const state = image.dataset.actorStateLayer;
      if (state) heroLayers.set(state, image);
      gsap.set(image, { autoAlpha: 0 });
    });
    if (stage) gsap.set(stage, { autoAlpha: 1, visibility: "visible" });
    stage?.querySelectorAll<HTMLElement>("[data-actor-slot]:not([data-actor-slot='white-truck'])").forEach((slot) => gsap.set(slot, { autoAlpha: 0, visibility: "hidden" }));
    if (heroSlot) gsap.set(heroSlot, { autoAlpha: 0, visibility: "visible" });

    const postStage = root.querySelector<HTMLElement>("[data-posthero-cinematic-layer]");
    const postSlots = new Map<PostHeroActorName, HTMLElement>();
    const postLayers = new Map<PostHeroActorKey, HTMLImageElement>();
    const displayedPostStates = new Map<PostHeroActorName, PostHeroActorKey>();
    postStage?.querySelectorAll<HTMLElement>("[data-posthero-actor-slot]").forEach((slot) => {
      const actor = slot.dataset.postheroActorSlot as PostHeroActorName;
      postSlots.set(actor, slot);
      slot.querySelectorAll<HTMLImageElement>("[data-posthero-actor-state]").forEach((image) => {
        const key = image.dataset.postheroActorState as PostHeroActorKey;
        postLayers.set(key, image);
        if (image.complete && image.naturalWidth > 0) markPostHeroActorReady(key);
        gsap.set(image, { autoAlpha: 0 });
      });
      gsap.set(slot, { autoAlpha: 0 });
    });

    const routePath = root.querySelector<SVGPathElement>("[data-network-route-path]");
    const routeSvg = routePath?.ownerSVGElement;
    const debugPanel = root.querySelector<HTMLElement>("[data-kt-motion-debug]");
    const debugEnabled = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("ktMotionDebug") === "1";
    if (debugPanel) {
      debugPanel.hidden = !debugEnabled;
      debugPanel.setAttribute("aria-hidden", String(!debugEnabled));
    }
    root.dataset.ktMotionDebug = String(debugEnabled);

    let routeLength = 0;
    let lastTone: "light" | "dark" | null = null;
    let raf = 0;
    let resizeTimer = 0;
    let latestChapter: HomeChapter = "hero";
    let latestProgress = 0;
    let heroUsableActorHeight = window.innerHeight;
    let stageTop = 0;
    let stageWidth = window.innerWidth;
    let selectedCategory = categories[0]?.id;
    let selectedProductDuringFan = products[0]?.id;
    let productSelectionFrozen = false;
    let committedProductId = selectedProductDuringFan;
    let committedStoreId = stores[0]?.id;
    let carrySourceRect: DOMRect | null = null;
    const heroActions = root.querySelector<HTMLElement>("[data-motion='hero-actions']");
    const heroKt = root.querySelector<HTMLElement>("[data-motion='hero-kt']");
    const heroCourier = root.querySelector<HTMLElement>("[data-motion='hero-courier']");
    const heroRoad = root.querySelector<HTMLElement>("[data-motion='hero-road']");
    const categoryRail = root.querySelector<HTMLElement>("[data-commerce-category-rail]");
    const categoryTrack = root.querySelector<HTMLElement>("[data-commerce-category-track]");
    const categoryCards = Array.from(root.querySelectorAll<HTMLElement>("[data-commerce-category]"));
    const productRail = root.querySelector<HTMLElement>("[data-commerce-product-fan]");
    const productCards = Array.from(root.querySelectorAll<HTMLElement>("[data-commerce-product]"));
    const storeRail = root.querySelector<HTMLElement>("[data-commerce-store-rail]");
    const storeCards = Array.from(root.querySelectorAll<HTMLElement>("[data-commerce-store-media]"));
    const commerceWorlds = Array.from(root.querySelectorAll<HTMLElement>("[data-commerce-world]"));
    const routeOccluders = Array.from(root.querySelectorAll<HTMLElement>("[data-route-occluder]"));

    const applyHero = (progress: number) => {
      const frame = resolveHeroTruckFrame(progress, window.innerWidth <= 767 ? "mobile" : "desktop");
      if (!heroSlot) return;
      const requestedLayer = heroLayers.get(frame.state);
      const nextLayer = frame.blendToState ? heroLayers.get(frame.blendToState) : undefined;
      const requestedReady = isActorImageReady(requestedLayer);
      let displayedState = frame.state;
      if (!requestedReady) {
        const readyStates = new Set(Array.from(heroLayers.entries()).filter(([, image]) => isActorImageReady(image)).map(([state]) => state));
        displayedState = closestReadyHeroSequenceState(frame.state, readyStates) ?? frame.state;
      }
      const activeLayer = heroLayers.get(displayedState);
      const definition = WHITE_TRUCK_STATES[displayedState as keyof typeof WHITE_TRUCK_STATES];
      if (!activeLayer || !definition) return;
      const canBlend = requestedReady && displayedState === frame.state && Boolean(nextLayer && frame.stateBlend && frame.stateBlend > 0 && isActorImageReady(nextLayer));
      const blend = canBlend ? frame.stateBlend ?? 0 : 0;
      heroLayers.forEach((image, state) => gsap.set(image, { autoAlpha: state === displayedState ? 1 - blend : canBlend && state === frame.blendToState ? blend : 0, visibility: "visible" }));
      const mobileHero = window.innerWidth <= 767;
      const sizingHeight = mobileHero ? heroUsableActorHeight : window.innerHeight;
      const targetWidthBase = mobileHero ? stageWidth : window.innerWidth;
      const visibleHeight = sizingHeight * (frame.sizeMode?.mode === "visible-height" ? frame.sizeMode.visibleHeightVh : 0) / 100;
      const height = visibleHeight / Math.max(.01, definition.visibleBounds.height);
      const width = height * definition.aspectRatio;
      const aligned = alignGroundContact({ width, height, groundContact: definition.groundContact, target: { x: targetWidthBase * frame.targetX, y: mobileHero ? heroUsableActorHeight * frame.groundY : window.innerHeight * frame.groundY - stageTop } });
      const presentation = deriveHeroActorPresentation({ actorVisible: frame.visible, imageReady: isActorImageReady(activeLayer), width, height });
      gsap.set(heroSlot, { x: aligned.left, y: aligned.top, width, height, rotation: frame.rotation, scale: frame.scale, transformOrigin: "0 0", autoAlpha: presentation.opacity, visibility: presentation.visibility });
      if (heroKt) gsap.set(heroKt, { y: prefersReducedMotion ? 0 : -14 * range(progress, HOME_BEATS.hero.centreSettle[0], HOME_BEATS.hero.cameraPass[1]), autoAlpha: prefersReducedMotion ? 1 : 1 - .7 * range(progress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1]) });
      if (heroCourier) gsap.set(heroCourier, { y: prefersReducedMotion ? 0 : 10 * range(progress, HOME_BEATS.hero.centreSettle[0], HOME_BEATS.hero.cameraPass[1]), autoAlpha: prefersReducedMotion ? 1 : 1 - .66 * range(progress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1]) });
      if (heroRoad) gsap.set(heroRoad, { autoAlpha: prefersReducedMotion ? 0 : .24 * range(progress, HOME_BEATS.hero.entryReveal[0], HOME_BEATS.hero.frontalApproach[1]) });
      if (heroActions) gsap.set(heroActions, { autoAlpha: prefersReducedMotion ? 1 : 1 - range(progress, ...HOME_BEATS.hero.entryReveal), y: prefersReducedMotion ? 0 : -10 * range(progress, ...HOME_BEATS.hero.entryReveal) });
      root.dataset.homeWhiteTruckVisible = String(presentation.isVisible);
      root.dataset.homeWhiteTruckState = displayedState;
      root.dataset.homeWhiteTruckNextState = frame.blendToState ?? "";
      root.dataset.homeWhiteTruckReady = String(requestedReady);
      root.dataset.homeWhiteTruckBlend = blend.toFixed(3);
    };

    const placeActor = (actor: PostHeroActorName, actorPose: PostHeroActorPose) => {
      const slot = postSlots.get(actor);
      if (!slot) return;
      const requestedLayer = postLayers.get(actorPose.state);
      const requestedDefinition = POST_HERO_ACTOR_ASSETS[actorPose.state];
      if (!requestedLayer || !requestedDefinition) {
        gsap.set(slot, { autoAlpha: 0, visibility: "hidden" });
        return;
      }
      const actorKeys = Array.from(postLayers.keys()).filter((key) => key.startsWith(`${actor}:`));
      const requestedIndex = actorKeys.indexOf(actorPose.state);
      const isReadyLayer = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;
      const activateLayer = (image: HTMLImageElement, key: PostHeroActorKey) => {
        if (!image.getAttribute("src")) {
          const deferredSrc = image.dataset.src;
          if (deferredSrc) {
            image.dataset.postheroActorStatus = "loading";
            image.src = deferredSrc;
          }
        }
        if (isPostHeroActorReady(key)) image.dataset.postheroActorStatus = "ready";
      };
      if (requestedLayer) activateLayer(requestedLayer, actorPose.state);
      const readyCandidates = actorKeys.map((key, index) => ({ key, index, image: postLayers.get(key) })).filter((candidate): candidate is { key: PostHeroActorKey; index: number; image: HTMLImageElement } => Boolean(candidate.image && isReadyLayer(candidate.image))).sort((a, b) => Math.abs(a.index - requestedIndex) - Math.abs(b.index - requestedIndex));
      const fallbackKey = displayedPostStates.get(actor);
      const fallbackImage = fallbackKey ? postLayers.get(fallbackKey) : undefined;
      const shownKey = requestedLayer && isReadyLayer(requestedLayer)
        ? actorPose.state
        : fallbackImage && fallbackKey && isReadyLayer(fallbackImage)
          ? fallbackKey
          : readyCandidates[0]?.key ?? actorPose.state;
      const layer = postLayers.get(shownKey) ?? requestedLayer;
      const definition = POST_HERO_ACTOR_ASSETS[shownKey] ?? requestedDefinition;
      if (!layer || !definition || (!isReadyLayer(layer) && !displayedPostStates.has(actor))) {
        gsap.set(slot, { autoAlpha: 0, visibility: "hidden" });
        slot.dataset.postheroVisible = "false";
        return;
      }
      activateLayer(layer, shownKey);
      displayedPostStates.set(actor, shownKey);
      const actorBox = computePostHeroActorBox({ viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, actor: definition, size: actorPose.size, anchor: { xVw: actorPose.anchorXVw, yVh: actorPose.anchorYVh } });
      const blendLayer = actorPose.blendToState ? postLayers.get(actorPose.blendToState) : undefined;
      const blendDefinition = actorPose.blendToState ? POST_HERO_ACTOR_ASSETS[actorPose.blendToState] : undefined;
      if (blendLayer) activateLayer(blendLayer, actorPose.blendToState!);
      const canBlend = Boolean(blendLayer && blendDefinition && actorPose.stateBlend && actorPose.stateBlend > 0 && isReadyLayer(blendLayer));
      postLayers.forEach((image) => {
        if (image.parentElement !== slot) return;
        const isCurrent = image === layer;
        const isBlend = canBlend && image === blendLayer;
        gsap.set(image, { autoAlpha: isCurrent ? (canBlend ? 1 - (actorPose.stateBlend ?? 0) : 1) : isBlend ? actorPose.stateBlend : 0 });
      });
      gsap.set(slot, { autoAlpha: actorPose.visible ? 1 : 0, visibility: actorPose.visible ? "visible" : "hidden", left: actorBox.left, top: actorBox.top, width: actorBox.width, height: actorBox.height, rotation: actorPose.rotation, transformOrigin: "0 0" });
      slot.dataset.postheroDisplayedState = shownKey;
      slot.dataset.postheroRequestedState = actorPose.state;
      slot.dataset.postheroStateReady = String(isPostHeroActorReady(shownKey) || (layer.complete && layer.naturalWidth > 0));
      slot.dataset.postheroPendingState = shownKey === actorPose.state ? "" : actorPose.state;
      slot.dataset.postheroVisible = String(actorPose.visible);
      slot.dataset.postheroSlotOpacity = String(actorPose.visible ? 1 : 0);
      slot.dataset.postheroX = String(actorBox.left);
      slot.dataset.postheroY = String(actorBox.top);
      slot.dataset.postheroWidth = String(actorBox.width);
      slot.dataset.postheroBlendState = canBlend ? actorPose.blendToState ?? "" : "";
      slot.dataset.postheroBlend = canBlend ? String(actorPose.stateBlend ?? 0) : "0";
    };

    const applyPostHero = (chapter: PostHeroChapter, rawProgress: number): PostHeroFrame => {
      const frame = resolvePostHeroFrame(chapter, rawProgress, window.innerWidth <= 767 ? "mobile" : "desktop", { categoryCount: categories.length, storeCount: stores.length, productCount: products.length });
      if (chapter === "commerce" && frame.marketplace) {
        const desktop = window.innerWidth >= 900;
        const commerceBeats = getCommerceBeats(stores.length);
        const categoryFocus = Math.round(frame.marketplace.positionIndex);
        const hasStoreWorld = stores.length >= 3;
        const categoryOpacity = categories.length === 0 ? 0 : hasStoreWorld
          ? 1 - range(rawProgress, ...commerceBeats.storeReveal)
          : 1 - range(rawProgress, ...commerceBeats.fanBuild);
        const storeOpacity = hasStoreWorld
          ? Math.min(range(rawProgress, ...commerceBeats.storeReveal), 1 - range(rawProgress, ...commerceBeats.storeExit))
          : 0;
        const productOpacity = products.length === 0 ? 0 : range(rawProgress, ...commerceBeats.fanBuild);
        commerceWorlds.forEach((world) => {
          const worldName = world.dataset.commerceWorld;
          const opacity = worldName === "categories" ? categoryOpacity : worldName === "stores" ? storeOpacity : worldName === "products" ? productOpacity : 0;
          const active = opacity > .5;
          world.dataset.commerceActive = String(active);
          gsap.set(world, { autoAlpha: opacity, x: worldName === "products" ? 16 * (1 - opacity) : worldName === "categories" ? -12 * (1 - opacity) : 0, scale: .98 + opacity * .02, pointerEvents: active ? "auto" : "none" });
        });
        const commerceHeader = root.querySelector<HTMLElement>("[data-commerce-opening]");
        if (commerceHeader) gsap.set(commerceHeader, { autoAlpha: prefersReducedMotion ? 1 : rawProgress < commerceBeats.apertureClear[0] ? 1 : 1 - range(rawProgress, ...commerceBeats.apertureClear), y: prefersReducedMotion ? 0 : -18 * range(rawProgress, ...commerceBeats.apertureClear) });
        categoryCards.forEach((card, index) => {
          if (!desktop) {
            gsap.set(card, { clearProps: "flexBasis,transform,opacity,zIndex" });
            card.dataset.marketplaceDistance = String(Math.round(Math.abs(index - frame.marketplace!.positionIndex)));
            return;
          }
          const distance = Math.abs(index - frame.marketplace!.positionIndex);
          const width = distance <= 1 ? 60 - 48 * distance : 8 - 4 * Math.min(1, distance - 1);
          gsap.set(card, { flexBasis: `${width}vw`, transform: `translateY(${Math.min(1.5, distance) * 1.5}px)`, opacity: distance > 2.5 ? .48 : 1, zIndex: index === categoryFocus ? 2 : 1 });
          card.dataset.marketplaceDistance = distance.toFixed(2);
          card.dataset.active = String(index === categoryFocus);
        });
        if (desktop && categoryRail && categoryTrack) {
          gsap.set(categoryTrack, { x: 0 });
          const railRect = categoryRail.getBoundingClientRect();
          const centers = categoryCards.map((card) => {
            const rect = card.getBoundingClientRect();
            return rect.left + rect.width / 2;
          });
          const desiredX = marketplaceTrackX(centers, frame.marketplace!.positionIndex, railRect.left + railRect.width / 2);
          const trackRect = categoryTrack.getBoundingClientRect();
          const minX = railRect.right - trackRect.right;
          const maxX = railRect.left - trackRect.left;
          gsap.set(categoryTrack, { x: Math.min(maxX, Math.max(minX, desiredX)) });
          categoryTrack.dataset.trackX = String(Math.round(Math.min(maxX, Math.max(minX, desiredX))));
        }
        productCards.forEach((card, index) => {
          if (!desktop) {
            gsap.set(card, { clearProps: "transform,zIndex,opacity" });
            return;
          }
          const distance = index - frame.marketplace!.productIndex;
          const absoluteDistance = Math.abs(distance);
          const x = Math.sign(distance) * (18 + Math.max(0, absoluteDistance - 1) * 14);
          const y = Math.min(5, absoluteDistance * 1.8);
          const scale = absoluteDistance < .5 ? 1 : absoluteDistance < 1.5 ? .78 : absoluteDistance < 2.5 ? .56 : absoluteDistance < 3.5 ? .4 : .3;
          const rotateY = -Math.sign(distance) * Math.min(18, 8 + Math.max(0, absoluteDistance - 1) * 5);
          const rotation = Math.sign(distance) * Math.min(2, .8 + Math.max(0, absoluteDistance - 1) * .3);
          const opacity = absoluteDistance <= 2 ? 1 - .12 * Math.max(0, absoluteDistance - 1) : .48;
          gsap.set(card, { xPercent: -50, yPercent: -50, x: x * window.innerWidth / 100, y: y * window.innerHeight / 100, rotationY: rotateY, rotation, scale, opacity, zIndex: Math.max(1, 10 - Math.round(absoluteDistance)) });
        });
      }
      const actorVisible = chapter === "network" || chapter === "freight" || chapter === "last-mile";
      if (postStage) gsap.set(postStage, { autoAlpha: actorVisible ? 1 : 0, visibility: actorVisible ? "visible" : "hidden" });
      if (routePath && routeSvg && frame.actors["white-truck"].visible) {
        if (!routeLength) routeLength = routePath.getTotalLength();
        const box = routeSvg.viewBox.baseVal;
        const svgRect = routeSvg.getBoundingClientRect();
        const point = routePath.getPointAtLength(routeLength * frame.routeProgress);
        const ahead = routePath.getPointAtLength(Math.min(routeLength, routeLength * frame.routeProgress + 2));
        const tangent = Math.atan2((ahead.y - point.y) * svgRect.height / box.height, (ahead.x - point.x) * svgRect.width / box.width) * 180 / Math.PI;
        frame.actors["white-truck"].anchorXVw = ((svgRect.left + point.x * svgRect.width / box.width) / window.innerWidth) * 100;
        frame.actors["white-truck"].anchorYVh = ((svgRect.top + point.y * svgRect.height / box.height) / window.innerHeight) * 100;
        frame.actors["white-truck"].rotation = tangent + 180;
      }
      if (routePath && routeSvg && routeLength) {
        const box = routeSvg.viewBox.baseVal;
        const svgRect = routeSvg.getBoundingClientRect();
        const seams = [
          { name: "straight-angled", progress: HOME_BEATS.network.angledTransition[0] + (HOME_BEATS.network.angledTransition[1] - HOME_BEATS.network.angledTransition[0]) / 2, route: .38 },
          { name: "angled-turning", progress: HOME_BEATS.network.turningTransition[0] + (HOME_BEATS.network.turningTransition[1] - HOME_BEATS.network.turningTransition[0]) / 2, route: .68 },
        ];
        routeOccluders.forEach((occluder) => {
          const seam = seams.find((candidate) => candidate.name === occluder.dataset.routeOccluder);
          if (!seam) return;
          const point = routePath.getPointAtLength(routeLength * seam.route);
          const ahead = routePath.getPointAtLength(Math.min(routeLength, routeLength * seam.route + 2));
          const tangent = Math.atan2((ahead.y - point.y) * svgRect.height / box.height, (ahead.x - point.x) * svgRect.width / box.width) * 180 / Math.PI;
          const distance = Math.abs(frame.progress - seam.progress);
          const seamAlpha = chapter === "network" ? Math.max(0, 1 - distance / .075) : 0;
          gsap.set(occluder, { left: `${(point.x / box.width) * 100}%`, top: `${(point.y / box.height) * 100}%`, transform: `translate(-50%, -50%) rotate(${tangent}deg)`, autoAlpha: seamAlpha });
        });
      }
      (Object.entries(frame.actors) as [PostHeroActorName, PostHeroActorPose][]).forEach(([actor, actorPose]) => placeActor(actor, actorPose));
      root.dataset.homeMotionOwner = frame.motionOwner;
      root.dataset.homeChapter = chapter;
      root.dataset.homeProgress = frame.progress.toFixed(3);
      root.dataset.homeVanState = frame.actors.van.visible ? frame.actors.van.state : "hidden";
      root.dataset.homeCourierState = frame.actors.courier.visible ? frame.actors.courier.state : "hidden";
      root.dataset.homeRecipientState = frame.actors.recipient.visible ? frame.actors.recipient.state : "hidden";
      root.dataset.homeHandoffState = frame.actors.handoff.visible ? frame.actors.handoff.state : "hidden";
      const packageCover = root.querySelector<HTMLElement>("[data-package-cover]");
      const packageBack = root.querySelector<HTMLElement>("[data-package-back]");
      if (packageCover) gsap.set(packageCover, { scale: .7 + frame.packageProgress * .3, autoAlpha: chapter === "parcelization" ? 1 : 0, clipPath: `inset(${(1 - frame.packageProgress) * 100}% 0 0 0)` });
      if (packageBack) gsap.set(packageBack, { scale: .7 + frame.packageProgress * .3, autoAlpha: chapter === "parcelization" ? .92 : 0 });
      const commerceSelectedMedia = root.querySelector<HTMLElement>("[data-commerce-selected-product-media='active']");
      const parcelSelectedMedia = root.querySelector<HTMLElement>("[data-parcel-selected-product-media]");
      const carryLayer = root.querySelector<HTMLElement>("[data-product-carry-layer]");
      const carryImage = root.querySelector<HTMLImageElement>("[data-product-carry-image]");
      const commerceCarryProgress = chapter === "commerce" ? range(frame.progress, ...getCommerceBeats(stores.length).selectedTakeover) : 0;
      // Commerce hands ownership to the fixed layer at the source; Parcel then
      // performs the measured source-to-target travel as its carry beat scrubs.
      const carryProgress = chapter === "parcelization" ? frame.selectedCarryProgress : 0;
      if (commerceSelectedMedia && chapter === "commerce") carrySourceRect = commerceSelectedMedia.getBoundingClientRect();
      const targetRect = parcelSelectedMedia?.getBoundingClientRect();
      const sourceRect = carrySourceRect ?? commerceSelectedMedia?.getBoundingClientRect();
      const carryActive = Boolean(carryImage && sourceRect && targetRect && (chapter === "commerce" ? commerceCarryProgress > 0 : chapter === "parcelization" && frame.selectedCarryProgress < 1));
      if (commerceSelectedMedia) gsap.set(commerceSelectedMedia, { autoAlpha: carryActive && chapter === "commerce" ? 0 : 1 });
      if (parcelSelectedMedia) gsap.set(parcelSelectedMedia, { autoAlpha: 0 });
      if (carryLayer && sourceRect && targetRect) {
        const left = sourceRect.left + (targetRect.left - sourceRect.left) * carryProgress;
        const top = sourceRect.top + (targetRect.top - sourceRect.top) * carryProgress;
        const width = sourceRect.width + (targetRect.width - sourceRect.width) * carryProgress;
        const height = sourceRect.height + (targetRect.height - sourceRect.height) * carryProgress;
        gsap.set(carryLayer, { left, top, width, height, borderRadius: `${18 * carryProgress}px`, autoAlpha: carryActive ? 1 : 0, zIndex: chapter === "parcelization" && frame.packageProgress > 0 ? 2 : 30 });
      } else if (carryLayer) gsap.set(carryLayer, { autoAlpha: 0 });
      const routeLine = root.querySelector<HTMLElement>("[data-label-route-line]");
      if (routeLine) gsap.set(routeLine, { scaleX: chapter === "parcelization" ? frame.labelRouteProgress : 0 });
      const overpassMask = root.querySelector<HTMLElement>("[data-route-overpass-mask]");
      if (overpassMask) {
        const networkMaskProgress = Math.max(range(frame.progress, HOME_BEATS.network.angledTransition[0], HOME_BEATS.network.angledTransition[1]), range(frame.progress, HOME_BEATS.network.turningTransition[0], HOME_BEATS.network.turningTransition[1]), range(frame.progress, HOME_BEATS.network.overpassTakeover[0], HOME_BEATS.network.overpassTakeover[1]));
        gsap.set(overpassMask, { autoAlpha: chapter === "network" ? networkMaskProgress : 0 });
      }
      const freightStreet = root.querySelector<HTMLElement>("[data-freight-local-street]");
      if (freightStreet) gsap.set(freightStreet, { autoAlpha: chapter === "freight" ? 1 : 0, clipPath: `inset(0 0 0 ${(1 - (chapter === "freight" ? frame.trailerProgress : 0)) * 100}%)` });
      const freightWord = root.querySelector<HTMLElement>("[data-freight-word]");
      const freightInfo = root.querySelector<HTMLElement>("[data-freight-info]");
      const freightCopy = root.querySelector<HTMLElement>("[data-freight-copy]");
      const freightInformationOpacity = chapter === "freight" ? 1 - range(frame.progress, ...HOME_BEATS.freight.giantSweepFront) : 0;
      if (freightWord) gsap.set(freightWord, { autoAlpha: freightInformationOpacity });
      if (freightInfo) gsap.set(freightInfo, { autoAlpha: freightInformationOpacity, y: 18 * (1 - freightInformationOpacity) });
      if (freightCopy) gsap.set(freightCopy, { autoAlpha: freightInformationOpacity, y: -18 * (1 - freightInformationOpacity) });
      const lastMileCopy = root.querySelector<HTMLElement>("[data-last-mile-copy]");
      const handoffCopy = root.querySelector<HTMLElement>("[data-handoff-copy]");
      const lastMileInformationOpacity = chapter === "last-mile" ? 1 - range(frame.progress, HOME_BEATS.lastMile.vanDoorOpen[0], HOME_BEATS.lastMile.courierReveal[1]) : 0;
      if (lastMileCopy) gsap.set(lastMileCopy, { autoAlpha: lastMileInformationOpacity, y: -16 * (1 - lastMileInformationOpacity) });
      if (handoffCopy) gsap.set(handoffCopy, { autoAlpha: lastMileInformationOpacity });
      const finaleDelivered = root.querySelector<HTMLElement>("[data-finale-delivered]");
      const finaleUtility = root.querySelector<HTMLElement>("[data-finale-utility]");
      const finaleLegal = root.querySelector<HTMLElement>("[data-finale-legal]");
      const finaleIdentity = root.querySelector<HTMLElement>("[data-finale-identity]");
      const finaleEnvironment = root.querySelector<HTMLElement>("[data-finale-environment]");
      if (chapter === "finale") {
        gsap.set(finaleDelivered, { autoAlpha: 1 - range(frame.progress, .18, .32) });
        gsap.set(finaleEnvironment, { autoAlpha: 1 - range(frame.progress, ...HOME_BEATS.finale.environmentFalloff), scale: 1 + .04 * range(frame.progress, ...HOME_BEATS.finale.environmentFalloff) });
        gsap.set(finaleIdentity, { autoAlpha: frame.brandProgress, y: 24 * (1 - frame.brandProgress) });
        gsap.set(finaleUtility, { autoAlpha: frame.utilityProgress });
        gsap.set(finaleLegal, { autoAlpha: frame.legalProgress });
      }
      return frame;
    };

    const measure = () => {
      sceneRanges.length = 0;
      root.querySelectorAll<HTMLElement>("[data-kt-scene]").forEach((section) => {
        const chapter = chapterFromSection(section);
        if (!chapter) return;
        const rect = section.getBoundingClientRect();
        const stickyStage = section.querySelector<HTMLElement>("[data-home-sticky-stage]");
        const stickyHeight = stickyStage?.getBoundingClientRect().height || window.innerHeight;
        const isSticky = stickyStage ? getComputedStyle(stickyStage).position === "sticky" : false;
        sceneRanges.push({ chapter, section, start: rect.top + window.scrollY, end: rect.bottom + window.scrollY, progressEnd: rect.top + window.scrollY + Math.max(1, isSticky ? rect.height - stickyHeight : rect.height) });
        section.dataset.homeMobilePolicy = HOME_MOBILE_POLICY[chapter];
      });
      const actorRect = stage?.getBoundingClientRect();
      if (actorRect) {
        stageTop = actorRect.top;
        stageWidth = actorRect.width || window.innerWidth;
        const mobileNav = document.querySelector<HTMLElement>("[data-kt-app-shell='mobile-nav']");
        heroUsableActorHeight = Math.max(0, actorRect.height - (mobileNav?.getBoundingClientRect().height ?? 0));
      }
      routeLength = 0;
    };

    const preloadTier = (chapter: HomeChapter, progress: number) => {
      if (chapter === "parcelization" && progress >= .18) void preloadPostHeroActorsForChapter("network");
      if (chapter === "network" && progress >= .6) ["red-truck:wipe-entry-01", "red-truck:wipe-entry-02", "red-truck:wipe-entry-03", "red-truck:wipe-side-full", "red-truck:wipe-trailer-hold"].forEach((key) => void preloadPostHeroActor(key as PostHeroActorKey));
      if ((chapter === "network" && progress >= .82) || chapter === "freight") void preloadPostHeroActorsForChapter("freight");
      if ((chapter === "freight" && progress >= .55) || chapter === "last-mile") postHeroActorsForChapter("last-mile").forEach((key) => void preloadPostHeroActor(key));
    };

    const syncMobileRailSelection = () => {
      if (window.innerWidth >= 900) return;
      const sync = (rail: HTMLElement | null, cards: HTMLElement[], onSelect: ((id: string) => void) | undefined, items: readonly { id: string }[], committed: "product" | "store" | "category") => {
        if (!rail || !cards.length || !onSelect) return;
        const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
        const nearest = cards.reduce((best, card, index) => {
          const cardCenter = card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2;
          const bestCenter = cards[best]!.getBoundingClientRect().left + cards[best]!.getBoundingClientRect().width / 2;
          return Math.abs(cardCenter - center) < Math.abs(bestCenter - center) ? index : best;
        }, 0);
        const id = committed === "store" ? cards[nearest]?.dataset.commerceStoreMedia : items[nearest]?.id;
        if (!id) return;
        if (committed === "product") committedProductId = commitSelection(committedProductId, id, onSelect);
        else if (committed === "store") committedStoreId = commitSelection(committedStoreId, id, onSelect);
        else if (id !== selectedCategory) { selectedCategory = id; onSelect?.(id); }
      };
      sync(categoryRail, categoryCards, onMarketplaceSelectionChange, categories, "category");
      sync(productRail, productCards, onProductSelectionChange, products, "product");
      sync(storeRail, storeCards, onStoreSelectionChange, stores, "store");
    };

    const seek = () => {
      const current = sceneRanges.find((item) => window.scrollY >= item.start && window.scrollY < item.end) ?? sceneRanges.at(-1);
      if (!current) return;
      const progress = clamp01((window.scrollY - current.start) / Math.max(1, current.progressEnd - current.start));
      const authoredProgress = current.chapter === "hero" ? (prefersReducedMotion ? .5 : progress) : (prefersReducedMotion ? reducedMotionChapterProgress(current.chapter, stores.length) : progress);
      latestChapter = current.chapter;
      latestProgress = progress;
      const tone = homeHeaderTone(current.chapter);
      if (tone !== lastTone) { lastTone = tone; setHeaderTone(tone); }
      const appliedFrame = current.chapter === "hero" ? undefined : applyPostHero(current.chapter, authoredProgress);
      if (current.chapter === "hero") applyHero(authoredProgress);
      preloadTier(current.chapter, progress);
      const desktopCommerceDirectorOwned = window.innerWidth >= 900;
      if (current.chapter === "commerce" && categories.length && desktopCommerceDirectorOwned) {
        const commerceBeats = getCommerceBeats(stores.length);
        const index = Math.min(categories.length - 1, Math.max(0, Math.round((authoredProgress - commerceBeats.categoryTraversal[0]) / (commerceBeats.categoryTraversal[1] - commerceBeats.categoryTraversal[0]) * (categories.length - 1))));
        const id = categories[Math.max(0, index)]?.id;
        if (id && id !== selectedCategory) { selectedCategory = id; onMarketplaceSelectionChange?.(id); }
      }
      if (current.chapter === "commerce" && appliedFrame?.marketplace && products.length && desktopCommerceDirectorOwned) {
        const product = products[Math.max(0, Math.min(products.length - 1, Math.round(appliedFrame.marketplace.productIndex)))];
        if (authoredProgress < getCommerceBeats(stores.length).selectedTakeover[0]) {
          productSelectionFrozen = false;
          selectedProductDuringFan = product?.id ?? selectedProductDuringFan;
        } else if (!productSelectionFrozen) {
          selectedProductDuringFan = product?.id ?? selectedProductDuringFan;
          productSelectionFrozen = true;
        }
        committedProductId = commitSelection(committedProductId, selectedProductDuringFan, onProductSelectionChange);
      }
      if (current.chapter === "commerce" && stores.length >= 3 && onStoreSelectionChange && desktopCommerceDirectorOwned) {
        const commerceBeats = getCommerceBeats(stores.length);
        const storeIndex = Math.min(stores.length - 1, Math.max(0, Math.floor(range(authoredProgress, ...commerceBeats.storeTraversal) * stores.length)));
        const storeId = stores[storeIndex]?.id;
        committedStoreId = commitSelection(committedStoreId, storeId, onStoreSelectionChange);
      }
      if (debugPanel && debugEnabled) {
        const marketplace = appliedFrame?.marketplace;
        const actorDebug = (actor: PostHeroActorName) => {
          const slot = postSlots.get(actor);
          const bounds = slot?.getBoundingClientRect();
          return `${actor} ${slot?.dataset.postheroRequestedState ?? "hidden"} -> ${slot?.dataset.postheroDisplayedState ?? "hidden"} ready=${slot?.dataset.postheroStateReady ?? "false"} anchor=${slot ? `${slot.offsetLeft.toFixed(1)},${slot.offsetTop.toFixed(1)}` : "-"} size=${bounds ? `${bounds.width.toFixed(1)}x${bounds.height.toFixed(1)}` : "-"}`;
        };
        debugPanel.textContent = `${current.chapter} · ${progress.toFixed(3)} · ${root.dataset.homeMotionOwner ?? "none"}\nviewport ${window.innerWidth <= 767 ? "mobile" : "desktop"}\ncategory ${marketplace?.activeIndex ?? "-"} · store ${marketplace?.storeIndex ?? "-"} · product ${marketplace?.productIndex ?? "-"}\nhero ${root.dataset.homeWhiteTruckState ?? "hidden"} ready=${root.dataset.homeWhiteTruckReady ?? "false"} blend=${root.dataset.homeWhiteTruckBlend ?? "0"}\n${actorDebug("van")}\n${actorDebug("courier")}\n${actorDebug("recipient")}\n${actorDebug("handoff")}\n${actorDebug("white-truck")}\n${actorDebug("red-truck")}`;
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; seek(); });
    };
    const resize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const chapter = latestChapter;
        const progress = latestProgress;
        measure();
        const target = sceneRanges.find((entry) => entry.chapter === chapter);
        if (target) window.scrollTo(0, target.start + progress * (target.progressEnd - target.start));
        seek();
        ScrollTrigger.refresh();
      }, 120);
    };

    measure();
    seek();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("load", schedule, { once: true });
    window.addEventListener("kt-posthero-actor-ready", schedule);
    categoryRail?.addEventListener("scroll", syncMobileRailSelection, { passive: true });
    productRail?.addEventListener("scroll", syncMobileRailSelection, { passive: true });
    storeRail?.addEventListener("scroll", syncMobileRailSelection, { passive: true });
    const trigger = prefersReducedMotion ? null : ScrollTrigger.create({ trigger: root, start: "top top", end: "bottom bottom", scrub: true });
    return () => {
      window.clearTimeout(resizeTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      window.removeEventListener("load", schedule);
      window.removeEventListener("kt-posthero-actor-ready", schedule);
      categoryRail?.removeEventListener("scroll", syncMobileRailSelection);
      productRail?.removeEventListener("scroll", syncMobileRailSelection);
      storeRail?.removeEventListener("scroll", syncMobileRailSelection);
      trigger?.kill();
    };
  }, [categories, enabled, onMarketplaceSelectionChange, onProductSelectionChange, onStoreSelectionChange, prefersReducedMotion, products, rootRef, setHeaderTone, stores]);
}
