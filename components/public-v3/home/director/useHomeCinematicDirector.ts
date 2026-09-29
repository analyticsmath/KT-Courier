"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { useMotionContext } from "../../motion/PublicMotionProvider";
import { HERO_VAN_BASELINE_Y, HERO_VAN_CANVAS_ASPECT, HERO_VAN_SEQUENCE, HERO_VAN_VISIBLE_CENTER_X, HERO_VAN_VISIBLE_CENTER_Y, HERO_VAN_VISIBLE_HEIGHT_RATIO } from "./hero-van-sequence.generated";
import { closestReadyHeroSequenceState, decodeHeroVanFrame, decodeHeroVanWindow, isActorImageReady } from "./home-actor-image-readiness";
import { deriveHeroActorPresentation } from "./hero-actor-presentation";
import { heroVanBlendWeights, resolveHeroVanFrame } from "./home-frame-resolver";
import { clamp01, HOME_BEATS, HOME_CINEMATIC_BEATS as B, range, smooth } from "./home-beats";
import { HOME_CHAPTERS, reducedMotionChapterProgress, type HomeChapter } from "./home-chapters";
import { categoryOrbitPose, heroVisibleUnderMarketplace, resolveHomeCinematicFrame, routeCamera, selectedProductIndex } from "./home-cinematic-frame-resolver";
import { HOME_BOX_SEQUENCE, HOME_DELIVERY_SEQUENCE, HOME_HANDOFF_SEQUENCE, HOME_PICKUP_SEQUENCE, HOME_RETURN_SEQUENCE, HOME_ROUTE_VAN_SEQUENCE } from "../data/home-cinematic-assets.generated";
import { preloadCinematicTier, preloadCinematicWindow } from "../actors/home-cinematic-preload";
import { showCinematicFrame } from "../actors/home-cinematic-runtime";

type SceneRange = { chapter: HomeChapter; start: number; end: number; progressEnd: number };
type Item = { id: string };

const visible = (element: HTMLElement | null, opacity: number) => { if (element) gsap.set(element, { autoAlpha: clamp01(opacity) }); };
const img = (root: Element, selector: string) => root.querySelector<HTMLImageElement>(selector);
const el = (root: Element, selector: string) => root.querySelector<HTMLElement>(selector);

export function useHomeCinematicDirector({ rootRef, categories, products, enabled, onMarketplaceSelectionChange, onProductSelectionChange }: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  categories: readonly Item[];
  products: readonly Item[];
  enabled: boolean;
  onMarketplaceSelectionChange?: (id: string) => void;
  onProductSelectionChange?: (id: string) => void;
}) {
  const { prefersReducedMotion, setHeaderTone } = useMotionContext();
  useEffect(() => {
    if (!enabled || !rootRef.current) return;
    const root = rootRef.current;
    const actorStage = el(root, "[data-kt-actor-stage]");
    const heroSlot = el(root, "[data-actor-slot='hero-van']");
    const heroLayers = new Map<string, HTMLImageElement>();
    heroSlot?.querySelectorAll<HTMLImageElement>("[data-actor-state-layer]").forEach((layer) => {
      if (layer.dataset.actorStateLayer) heroLayers.set(layer.dataset.actorStateLayer, layer);
      gsap.set(layer, { opacity: 0 });
    });
    actorStage?.querySelectorAll<HTMLElement>("[data-actor-slot]:not([data-actor-slot='hero-van'])").forEach((slot) => visible(slot, 0));
    if (actorStage) gsap.set(actorStage, { autoAlpha: 1, visibility: "visible" });
    for (const index of [0, 1, 2, 3, 18, ...(prefersReducedMotion ? [10] : [])]) void decodeHeroVanFrame(heroLayers.get(HERO_VAN_SEQUENCE[index]));
    const activeHeroStates = new Set<string>();
    const heroKt = el(root, "[data-motion='hero-kt']");
    const heroCourier = el(root, "[data-motion='hero-courier']");
    const heroActions = el(root, "[data-motion='hero-actions']");
    const takeover = el(root, "[data-marketplace-takeover]");
    const opening = el(root, "[data-cinematic-commerce-opening]");
    const categoryField = el(root, "[data-cinematic-category-field]");
    const categoryPlanes = Array.from(root.querySelectorAll<HTMLElement>("[data-cinematic-category-plane]"));
    const mobileOrbit = el(root, "[data-cinematic-mobile-orbit]");
    const mobileOrbitCards = Array.from(root.querySelectorAll<HTMLElement>("[data-cinematic-mobile-orbit-card]"));
    const mobileTerritory = el(root, "[data-cinematic-mobile-category-territory]");
    const mobileRail = el(root, "[data-cinematic-mobile-category-rail]");
    const productWorld = el(root, "[data-cinematic-product-world]");
    const productPlanes = Array.from(root.querySelectorAll<HTMLElement>("[data-cinematic-product-plane]"));
    const productMedias = productPlanes.map((plane) => plane.querySelector<HTMLElement>("span"));
    const productImages = productMedias.map((media) => media?.querySelector<HTMLImageElement>("img"));
    const productInfo = el(root, "[data-cinematic-product-info]");
    const carry = el(root, "[data-product-carry-layer]");
    const carryImage = img(root, "[data-product-carry-image]");
    const box = el(root, "[data-cinematic-box]");
    const boxImage = img(root, "[data-cinematic-box-image]");
    const boxForeground = el(root, "[data-cinematic-box-foreground]");
    const boxForegroundImage = img(root, "[data-cinematic-box-foreground-image]");
    const pickup = el(root, "[data-cinematic-pickup]");
    const pickupImage = img(root, "[data-cinematic-pickup-image]");
    const packedWord = el(root, "[data-pickup-word='packed']");
    const collectedWord = el(root, "[data-pickup-word='collected']");
    const routeStage = el(root, "[data-cinematic-route-camera]");
    const routeWorld = el(root, "[data-cinematic-route-world]");
    const roadImage = img(root, "[data-cinematic-road]");
    const routeVan = el(root, "[data-cinematic-route-van]");
    const routeVanImage = img(root, "[data-cinematic-route-van-image]");
    const routeCopies = ["collected", "way", "moving"].map((name) => el(root, `[data-route-copy='${name}']`));
    const truck = el(root, "[data-cinematic-red-truck]");
    const truckImage = img(root, "[data-cinematic-red-truck-image]");
    const freightReveal = el(root, "[data-cinematic-freight-reveal]");
    const delivery = el(root, "[data-cinematic-delivery]");
    const deliveryImage = img(root, "[data-cinematic-delivery-image]");
    const handoff = el(root, "[data-cinematic-handoff]");
    const handoffImage = img(root, "[data-cinematic-handoff-image]");
    const lastMileCopy = el(root, "[data-cinematic-last-mile-copy]");
    const delivered = el(root, "[data-cinematic-delivered]");
    const brand = el(root, "[data-cinematic-finale-brand]");
    const utility = el(root, "[data-cinematic-finale-utility]");
    const legal = el(root, "[data-cinematic-finale-legal]");
    const debugPanel = el(root, "[data-kt-motion-debug]");
    const debug = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("ktMotionDebug") === "1";
    if (debugPanel) debugPanel.hidden = !debug;
    const ranges: SceneRange[] = [];
    let stageWidth = window.innerWidth;
    let heroBaseWidth = window.innerWidth;
    let heroBaseHeight = window.innerWidth / HERO_VAN_CANVAS_ASPECT;
    let heroUsableHeight = window.innerHeight;
    let worldWidth = window.innerWidth;
    let worldHeight = window.innerHeight;
    let boxRect = new DOMRect(window.innerWidth * .3, window.innerHeight * .3, window.innerWidth * .4, window.innerWidth * .4);
    let lastTone: "light" | "dark" | null = null;
    let selectedProduct = products[0]?.id;
    let selectedCategory = categories[0]?.id;
    let frozenProductIndex: number | undefined;
    let carrySource: DOMRect | undefined;
    let raf = 0;
    let resizeTimer = 0;
    let latestChapter: HomeChapter = "hero";
    let latestProgress = 0;

    const measure = () => {
      ranges.length = 0;
      root.querySelectorAll<HTMLElement>("[data-kt-scene]").forEach((section) => {
        const chapter = section.dataset.ktScene as HomeChapter;
        if (!HOME_CHAPTERS.includes(chapter)) return;
        const rect = section.getBoundingClientRect();
        const start = rect.top + window.scrollY;
        const stage = section.querySelector<HTMLElement>("[data-home-sticky-stage]");
        const sticky = stage && getComputedStyle(stage).position === "sticky";
        const stageHeight = sticky ? stage.getBoundingClientRect().height : 0;
        ranges.push({ chapter, start, end: rect.bottom + window.scrollY, progressEnd: start + Math.max(1, rect.height - stageHeight) });
      });
      const stageRect = actorStage?.getBoundingClientRect();
      if (stageRect) {
        stageWidth = stageRect.width;
        heroBaseWidth = stageWidth;
        heroBaseHeight = heroBaseWidth / HERO_VAN_CANVAS_ASPECT;
        const nav = document.querySelector<HTMLElement>("[data-kt-app-shell='mobile-nav']");
        heroUsableHeight = stageRect.height - (window.innerWidth <= 767 ? nav?.getBoundingClientRect().height ?? 0 : 0);
        if (heroSlot) gsap.set(heroSlot, { width: heroBaseWidth, height: heroBaseHeight, transformOrigin: "0 0" });
      }
      worldWidth = routeWorld?.offsetWidth || window.innerWidth;
      worldHeight = routeWorld?.offsetHeight || window.innerHeight;
      boxRect = box?.getBoundingClientRect() ?? boxRect;
    };

    const applyHero = (progress: number, covered: boolean) => {
      const mobile = window.innerWidth <= 767;
      const frame = prefersReducedMotion
        ? { ...resolveHeroVanFrame(.5, mobile ? "mobile" : "desktop"), state: HERO_VAN_SEQUENCE[10], blendToState: undefined, stateBlend: 0, phase: "hold" as const, anchorMode: "center" as const, anchorBlend: 1, targetCenterX: .5, visibleCenterY: .55, visibleHeightVh: mobile ? 54 : 56, opacity: 1, visible: true }
        : resolveHeroVanFrame(progress, mobile ? "mobile" : "desktop");
      if (!heroSlot) return;
      decodeHeroVanWindow(heroLayers, frame.state);
      const requested = heroLayers.get(frame.state);
      const ready = isActorImageReady(requested);
      const readyStates = new Set<string>();
      for (const [state, image] of heroLayers) if (isActorImageReady(image)) readyStates.add(state);
      const shownState = ready ? frame.state : closestReadyHeroSequenceState(frame.state, readyStates) ?? frame.state;
      const active = heroLayers.get(shownState);
      if (!active) return;
      const next = frame.blendToState ? heroLayers.get(frame.blendToState) : undefined;
      const blend = ready && shownState === frame.state && next && isActorImageReady(next) ? frame.stateBlend : 0;
      const weights = heroVanBlendWeights(blend);
      const nextStates = new Set([shownState, ...(blend && frame.blendToState ? [frame.blendToState] : [])]);
      for (const state of activeHeroStates) if (!nextStates.has(state)) { const layer = heroLayers.get(state); if (layer) gsap.set(layer, { opacity: 0 }); }
      gsap.set(active, { opacity: weights.current });
      if (blend && next) gsap.set(next, { opacity: weights.next });
      activeHeroStates.clear(); nextStates.forEach((state) => activeHeroStates.add(state));
      const desiredVisibleHeight = heroUsableHeight * frame.visibleHeightVh / 100;
      const scaledHeight = desiredVisibleHeight / HERO_VAN_VISIBLE_HEIGHT_RATIO;
      const scale = scaledHeight / heroBaseHeight;
      const scaledWidth = heroBaseWidth * scale;
      const x = stageWidth * frame.targetCenterX - HERO_VAN_VISIBLE_CENTER_X * scaledWidth;
      const groundTop = heroUsableHeight * frame.groundY - HERO_VAN_BASELINE_Y * scaledHeight;
      const centerTop = heroUsableHeight * frame.visibleCenterY - HERO_VAN_VISIBLE_CENTER_Y * scaledHeight;
      const y = groundTop + (centerTop - groundTop) * frame.anchorBlend;
      const presentation = deriveHeroActorPresentation({ actorVisible: frame.visible, imageReady: isActorImageReady(active), width: scaledWidth, height: scaledHeight });
      gsap.set(heroSlot, { x, y, scale, transformOrigin: "0 0", autoAlpha: covered ? 0 : presentation.opacity * frame.opacity });
      const falloff = smooth(range(progress, .13, .34));
      if (heroKt) gsap.set(heroKt, { y: prefersReducedMotion ? 0 : -14 * range(progress, .22, .97), autoAlpha: prefersReducedMotion ? 1 : 1 - .78 * falloff });
      if (heroCourier) gsap.set(heroCourier, { y: prefersReducedMotion ? 0 : 10 * range(progress, .22, .97), autoAlpha: prefersReducedMotion ? 1 : 1 - .84 * falloff });
      if (heroActions) gsap.set(heroActions, { autoAlpha: prefersReducedMotion ? 1 : 1 - range(progress, ...HOME_BEATS.hero.entryReveal), y: prefersReducedMotion ? 0 : -10 * range(progress, ...HOME_BEATS.hero.entryReveal) });
      if (debug) { root.dataset.homeHeroVanPhase = frame.phase; root.dataset.homeHeroVanState = shownState; root.dataset.homeHeroVanVisible = String(!covered && presentation.isVisible); }
    };

    const applyFilm = (chapter: HomeChapter, p: number) => {
      const mobile = window.innerWidth <= 767;
      const f = resolveHomeCinematicFrame(chapter, p, mobile, categories.length, products.length);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isCommerce = chapter === "commerce";
      const isParcel = chapter === "parcelization";
      const isPickup = chapter === "pickup";
      const isNetwork = chapter === "network";
      const isFreight = chapter === "freight";
      const isLastMile = chapter === "last-mile";
      const isFinale = chapter === "finale";
      const cover = isCommerce ? f.cover : chapter === "hero" ? 0 : 1;
      if (takeover) gsap.set(takeover, { yPercent: 100 * (1 - cover), visibility: isCommerce ? "visible" : "hidden" });
      if (chapter === "hero" || (isCommerce && heroVisibleUnderMarketplace(cover))) applyHero(chapter === "hero" ? p : 1, false);
      else if (heroSlot) visible(heroSlot, 0);
      visible(opening, isCommerce ? (1 - range(p, .14, .25)) * cover : 0);
      if (opening && isCommerce) gsap.set(opening, { clipPath: `inset(0 0 ${range(p, .16, .26) * 100}% 0)` });
      const categoryOpacity = isCommerce && p >= .08 && p < .69 ? 1 : 0;
      visible(categoryField, !mobile ? categoryOpacity : 0);
      visible(mobileOrbit, mobile && isCommerce && p >= .08 && p < .30 ? 1 : 0);
      visible(mobileTerritory, mobile && isCommerce && p >= .30 && p < .64 ? 1 : 0);
      if (isCommerce && !mobile) {
        const resolve = f.orbitResolve;
        const exit = range(p, .62, .69);
        categoryPlanes.forEach((plane, index) => {
          const orbit = categoryOrbitPose(index, categoryPlanes.length, f.orbit, false);
          const targetX = (index - f.categoryPosition) * viewportWidth * .67;
          const x = orbit.x * (1 - resolve) + targetX * resolve;
          const z = orbit.z * (1 - resolve);
          const scale = (.27 * orbit.scale) * (1 - resolve) + (1 - .14 * exit) * resolve;
          gsap.set(plane, { transform: `translate3d(-50%,-50%,0) translate3d(${x}px,${-exit * viewportHeight * .18}px,${z}px) rotateY(${orbit.rotationY * (1 - resolve)}deg) scale(${scale})`, zIndex: Math.round(1000 + z), pointerEvents: p < .30 || Math.abs(index - f.categoryPosition) <= .6 ? "auto" : "none" });
        });
        const index = Math.min(categories.length - 1, Math.max(0, Math.round(f.categoryPosition)));
        const id = categories[index]?.id;
        if (id && id !== selectedCategory) { selectedCategory = id; onMarketplaceSelectionChange?.(id); }
      }
      if (isCommerce && mobile) mobileOrbitCards.forEach((card, index) => {
        const pose = categoryOrbitPose(index, mobileOrbitCards.length, f.orbit, true);
        gsap.set(card, { transform: `translate3d(-50%,-50%,0) translate3d(${pose.x}px,0,${pose.z}px) rotateY(${pose.rotationY}deg) scale(${pose.scale * .88})`, zIndex: Math.round(1000 + pose.z) });
      });
      const fanVisible = isCommerce && p >= .60;
      visible(productWorld, fanVisible ? 1 : 0);
      const selectedIndex = selectedProductIndex(products.length, f.fanPosition, f.selectedTakeover, frozenProductIndex);
      if (isCommerce && p < B.commerce.selectedTakeover[0]) frozenProductIndex = undefined;
      if (isCommerce && p >= B.commerce.selectedTakeover[0] && frozenProductIndex === undefined) frozenProductIndex = Math.max(0, selectedIndex);
      if (fanVisible) {
        const center = frozenProductIndex ?? selectedIndex;
        productPlanes.forEach((plane, index) => {
          const offset = index - f.fanPosition;
          const distance = Math.abs(offset);
          const spread = f.fanSpread;
          const exit = f.selectedTakeover;
          const x = Math.sign(offset) * Math.min(distance, 3.5) * viewportWidth * (mobile ? .20 : .125) * spread + (index === center ? 0 : Math.sign(offset || 1) * exit * viewportWidth);
          const y = -viewportHeight * .02 + distance * viewportHeight * .025 * spread + (index === center ? 0 : exit * viewportHeight * .08);
          const scale = (1 - Math.min(distance, 4) * (mobile ? .08 : .10) * spread) * (index === center ? 1 : 1 - exit * .15);
          const rotation = offset * (mobile ? 4 : 6) * spread;
          gsap.set(plane, { transform: `translate3d(-50%,-50%,0) translate3d(${x}px,${y}px,0) rotate(${rotation}deg) scale(${scale})`, zIndex: 50 - Math.round(distance * 6), autoAlpha: distance > (mobile ? 2.5 : 4.5) && spread > .1 ? 0 : 1, pointerEvents: exit > .1 && index !== center ? "none" : "auto" });
          plane.tabIndex = exit > .1 && index !== center ? -1 : 0;
        });
        const nextId = products[center]?.id;
        if (nextId && nextId !== selectedProduct) { selectedProduct = nextId; onProductSelectionChange?.(nextId); }
      }
      visible(productInfo, fanVisible && p < .93 ? 1 : 0);

      // The selected source yields its exact viewport rectangle to one fixed carry.
      const selectedPlaneIndex = Math.max(0, productPlanes.findIndex((plane) => plane.dataset.productId === selectedProduct));
      const selectedMedia = productMedias[selectedPlaneIndex];
      const commerceCarry = isCommerce && p >= B.commerce.selectedTakeover[0];
      if (commerceCarry && selectedMedia && !carrySource) carrySource = selectedMedia.getBoundingClientRect();
      const selectedImage = productImages[selectedPlaneIndex];
      if (commerceCarry && selectedImage && carryImage) {
        const sourceUrl = selectedImage.currentSrc || selectedImage.src;
        if (sourceUrl && carryImage.src !== sourceUrl) carryImage.src = sourceUrl;
      }
      if (isCommerce && p < B.commerce.selectedTakeover[0]) carrySource = undefined;
      const source = carrySource ?? new DOMRect(viewportWidth * (mobile ? .12 : .385), viewportHeight * .28, viewportWidth * (mobile ? .76 : .23), viewportHeight * .56);
      const productTarget = { x: boxRect.left + boxRect.width * .42, y: boxRect.top + boxRect.height * .32, width: boxRect.width * .18, height: boxRect.height * .25 };
      const descend = isParcel ? f.productDescend : 0;
      const carryReady = Boolean(carryImage?.complete && carryImage.naturalWidth > 0);
      const carryActive = Boolean(products.length && carryReady && (commerceCarry || (isParcel && p < B.parcelization.boxClose[0])));
      productMedias.forEach((media, index) => {
        if (media) visible(media, commerceCarry && carryActive && index === selectedPlaneIndex ? 0 : 1);
      });
      if (carry) {
        const x = source.left + (productTarget.x - source.left) * descend;
        const y = source.top + (productTarget.y - source.top) * descend;
        const scaleX = 1 + (productTarget.width / source.width - 1) * descend;
        const scaleY = 1 + (productTarget.height / source.height - 1) * descend;
        gsap.set(carry, { left: 0, top: 0, width: source.width, height: source.height, transformOrigin: "0 0", transform: `translate3d(${x}px,${y}px,0) scale(${scaleX},${scaleY})`, clipPath: `inset(0 0 ${(isParcel ? f.productOcclusion : 0) * 100}% 0)`, autoAlpha: carryActive ? 1 : 0 });
      }
      const boxVisible = isParcel || (isPickup && p < .16);
      if (boxVisible) {
        const id = HOME_BOX_SEQUENCE[isParcel ? f.boxIndex : HOME_BOX_SEQUENCE.length - 1];
        preloadCinematicWindow(HOME_BOX_SEQUENCE, isParcel ? f.boxIndex : HOME_BOX_SEQUENCE.length - 1, mobile);
        visible(box, showCinematicFrame(boxImage, id, mobile) ? 1 : 0);
        if (isParcel && p < .36) visible(boxForeground, showCinematicFrame(boxForegroundImage, HOME_BOX_SEQUENCE[0], mobile) ? 1 : 0);
        else visible(boxForeground, 0);
      } else { visible(box, 0); visible(boxForeground, 0); }
      if (isPickup) {
        preloadCinematicWindow(HOME_PICKUP_SEQUENCE, f.pickupIndex, mobile);
        visible(pickup, showCinematicFrame(pickupImage, HOME_PICKUP_SEQUENCE[f.pickupIndex], mobile) ? 1 : 0);
        if (pickup) gsap.set(pickup, { xPercent: -50, yPercent: -50, x: viewportWidth * f.pickupX / 100 });
      } else visible(pickup, 0);
      visible(packedWord, isPickup && p < .5 ? 1 : 0);
      visible(collectedWord, isPickup && p >= .5 ? 1 : 0);

      const routeVisible = isNetwork || (isFreight && p < B.freight.redSweepContinue[1]);
      visible(routeStage, routeVisible ? 1 : 0);
      if (routeStage) gsap.set(routeStage, { zIndex: isFreight ? 25 : 35 });
      if (routeVisible && routeWorld) {
        const route = isNetwork ? f.route : resolveHomeCinematicFrame("network", 1, mobile, categories.length, products.length).route;
        const scale = isNetwork ? f.cameraScale : mobile ? 1.1 : .95;
        const anchorX = mobile ? viewportWidth * .52 : viewportWidth * (route.point.y > .40 ? .70 : .56);
        const anchorY = viewportHeight * .54;
        const camera = routeCamera(route.point, { width: worldWidth, height: worldHeight }, { x: anchorX, y: anchorY }, scale);
        gsap.set(routeWorld, { transform: `translate3d(${camera.x}px,${camera.y}px,0) scale(${scale})` });
        if (roadImage) visible(roadImage, showCinematicFrame(roadImage, "road-00", mobile) ? 1 : 0);
        preloadCinematicWindow(HOME_ROUTE_VAN_SEQUENCE, route.index, mobile);
        visible(routeVan, showCinematicFrame(routeVanImage, HOME_ROUTE_VAN_SEQUENCE[route.index], mobile) ? 1 : 0);
        if (routeVan) gsap.set(routeVan, { left: `${route.point.x * 100}%`, top: `${route.point.y * 100}%`, rotation: route.residual, xPercent: -50, yPercent: -50 });
      }
      routeCopies.forEach((copy, index) => {
        const start = [0, .28, .56][index];
        const end = [.34, .64, .9][index];
        const inT = range(p, start, start + .06);
        const outT = range(p, end - .06, end);
        visible(copy, isNetwork ? inT * (1 - outT) : 0);
        if (copy && isNetwork) gsap.set(copy, { x: (1 - inT) * -viewportWidth * .12 + outT * viewportWidth * .08, clipPath: `inset(0 ${outT * 100}% 0 ${(1 - inT) * 100}%)` });
      });
      const truckVisible = (isNetwork && p >= B.network.redSweepStart[0]) || (isFreight && p <= B.freight.redSweepContinue[1]);
      if (truckVisible) {
        visible(truck, showCinematicFrame(truckImage, "red-truck-top-00", mobile) ? 1 : 0);
        if (truck) gsap.set(truck, { xPercent: -50, yPercent: -50, x: (f.truckX - 50) * viewportWidth / 100 });
      } else visible(truck, 0);
      if (freightReveal) gsap.set(freightReveal, { clipPath: `inset(0 ${(1 - (isFreight ? f.freightReveal : 0)) * 100}% 0 0)` });

      if (isLastMile) {
        const b = B.lastMile;
        const isHandoff = p >= b.handoff[0] && p < b.courierReturn[0];
        const isReturn = p >= b.courierReturn[0];
        const index = isReturn ? f.returnIndex : isHandoff ? 5 : f.deliveryIndex;
        const ids = isReturn ? HOME_RETURN_SEQUENCE : HOME_DELIVERY_SEQUENCE;
        preloadCinematicWindow(ids, index, mobile);
        visible(delivery, showCinematicFrame(deliveryImage, ids[index], mobile) ? 1 : 0);
        if (delivery) gsap.set(delivery, { xPercent: -50, yPercent: -50, x: viewportWidth * f.deliveryX / 100 });
        if (isHandoff) {
          preloadCinematicWindow(HOME_HANDOFF_SEQUENCE, f.handoffIndex, mobile);
          visible(handoff, showCinematicFrame(handoffImage, HOME_HANDOFF_SEQUENCE[f.handoffIndex], mobile) ? 1 : 0);
          if (handoff) gsap.set(handoff, { xPercent: -50, yPercent: -50, x: viewportWidth * range(p, .76, .82) * .23, clipPath: `inset(0 0 0 ${range(p, .79, .82) * 100}%)` });
        } else visible(handoff, 0);
      } else { visible(delivery, 0); visible(handoff, 0); }
      visible(lastMileCopy, isLastMile ? 1 - range(p, .18, .40) : 0);
      visible(delivered, isFinale ? 1 - range(p, .18, .32) : 0);
      visible(brand, isFinale ? f.brand : 0);
      if (brand && isFinale) gsap.set(brand, { y: 35 * (1 - f.brand) });
      visible(utility, isFinale ? f.utility : 0);
      visible(legal, isFinale ? f.legal : 0);
      preloadCinematicTier(chapter, p, mobile);
      if (debug) {
        root.dataset.homeChapter = chapter;
        root.dataset.homeProgress = p.toFixed(3);
        root.dataset.homeMotionOwner = f.motionOwner;
        const family = isParcel ? "box" : isPickup ? "pickup" : isNetwork ? "route-van" : isLastMile ? p >= B.lastMile.courierReturn[0] ? "return" : p >= B.lastMile.handoff[0] ? "handoff" : "delivery" : "";
        const index = isParcel ? f.boxIndex : isPickup ? f.pickupIndex : isNetwork ? f.route.index : isLastMile ? family === "return" ? f.returnIndex : family === "handoff" ? f.handoffIndex : f.deliveryIndex : -1;
        root.dataset.homeSequenceFamily = family;
        root.dataset.homeSequenceIndex = String(index);
        root.dataset.homeRouteProgress = f.routeProgress.toFixed(3);
        root.dataset.homeRouteTangent = f.route.tangent.toFixed(2);
        root.dataset.homeRouteCameraScale = f.cameraScale.toFixed(3);
        root.dataset.homeCategoryProgress = f.categoryPosition.toFixed(3);
        root.dataset.homeProductId = selectedProduct ?? "";
        if (debugPanel) debugPanel.textContent = `${chapter} ${p.toFixed(3)} · ${f.motionOwner}\n${family} ${index} · route ${f.routeProgress.toFixed(3)} ${f.route.tangent.toFixed(1)}° · product ${selectedProduct ?? "none"}`;
      }
    };

    const seek = () => {
      const current = ranges.find((item) => window.scrollY >= item.start && window.scrollY < item.end) ?? ranges.at(-1);
      if (!current) return;
      const progress = clamp01((window.scrollY - current.start) / Math.max(1, current.progressEnd - current.start));
      const authored = prefersReducedMotion && current.chapter !== "hero" ? reducedMotionChapterProgress(current.chapter) : progress;
      latestChapter = current.chapter; latestProgress = progress;
      const tone = (["commerce", "parcelization", "pickup", "network", "freight", "last-mile", "finale"] as HomeChapter[]).includes(current.chapter) ? "dark" : "light";
      if (tone !== lastTone) { lastTone = tone; setHeaderTone(tone); }
      applyFilm(current.chapter, authored);
    };
    const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; seek(); }); };
    const resize = () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => {
      const chapter = latestChapter, progress = latestProgress;
      measure();
      const target = ranges.find((range) => range.chapter === chapter);
      if (target) window.scrollTo(0, target.start + progress * (target.progressEnd - target.start));
      carrySource = undefined;
      seek();
    }, 120); };
    const railScroll = () => {
      if (!mobileRail || !categories.length) return;
      const center = mobileRail.getBoundingClientRect().left + mobileRail.clientWidth / 2;
      const cards = Array.from(mobileRail.querySelectorAll<HTMLElement>("[data-mobile-category-id]"));
      const nearest = cards.reduce((best, card, index) => Math.abs(card.getBoundingClientRect().left + card.clientWidth / 2 - center) < Math.abs(cards[best].getBoundingClientRect().left + cards[best].clientWidth / 2 - center) ? index : best, 0);
      const id = cards[nearest]?.dataset.mobileCategoryId;
      if (id && id !== selectedCategory) { selectedCategory = id; onMarketplaceSelectionChange?.(id); }
    };
    measure(); seek();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("load", schedule, { once: true });
    window.addEventListener("kt-hero-van-ready", schedule);
    window.addEventListener("kt-home-cinematic-ready", schedule);
    mobileRail?.addEventListener("scroll", railScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf); window.clearTimeout(resizeTimer);
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", resize); window.removeEventListener("load", schedule);
      window.removeEventListener("kt-hero-van-ready", schedule); window.removeEventListener("kt-home-cinematic-ready", schedule);
      mobileRail?.removeEventListener("scroll", railScroll);
    };
  }, [rootRef, categories, products, enabled, onMarketplaceSelectionChange, onProductSelectionChange, prefersReducedMotion, setHeaderTone]);
}
