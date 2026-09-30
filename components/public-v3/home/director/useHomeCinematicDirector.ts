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
import { heroVisibleUnderMarketplace, resolveHomeCinematicFrame, routeCamera } from "./home-cinematic-frame-resolver";
import { HOME_CINEMATIC_ASSET_BY_ID, HOME_ROUTE_VAN_SEQUENCE } from "../data/home-cinematic-assets.generated";
import { preloadCinematicTier, preloadCinematicWindow } from "../actors/home-cinematic-preload";
import { preloadCinematicAsset, showCinematicFrame } from "../actors/home-cinematic-runtime";
import { centeredFanOffset, selectedProductForTakeover, truckTrailingEdgeReveal, uniformProductPose } from "./home-cinematic-mechanics";
import { BOX_PLATES, DELIVERY_PLATES, HANDOFF_PLATES, PICKUP_PLATES, RETURN_PLATES, deliveryPlateIndex, isTightVanPlate, pickupPlateIndex, plateIndex } from "./home-performance-sequences";

type SceneRange = { chapter: HomeChapter; start: number; end: number; progressEnd: number };
type Item = { id: string };

const visible = (element: HTMLElement | null, opacity: number) => { if (element) gsap.set(element, { autoAlpha: clamp01(opacity) }); };
const img = (root: Element, selector: string) => root.querySelector<HTMLImageElement>(selector);
const el = (root: Element, selector: string) => root.querySelector<HTMLElement>(selector);

export function useHomeCinematicDirector({ rootRef, categories, products, selectedProductId, enabled, onMarketplaceSelectionChange }: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  categories: readonly Item[];
  products: readonly Item[];
  selectedProductId?: string;
  enabled: boolean;
  onMarketplaceSelectionChange?: (id: string) => void;
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
    void preloadCinematicAsset(HOME_ROUTE_VAN_SEQUENCE[0], window.innerWidth <= 767);
    const activeHeroStates = new Set<string>();
    const heroKt = el(root, "[data-motion='hero-kt']");
    const heroCourier = el(root, "[data-motion='hero-courier']");
    const heroActions = el(root, "[data-motion='hero-actions']");
    const takeover = el(root, "[data-marketplace-takeover]");
    const opening = el(root, "[data-cinematic-commerce-opening]");
    const categoryField = el(root, "[data-cinematic-category-field]");
    const categoryPlanes = Array.from(root.querySelectorAll<HTMLElement>("[data-cinematic-category-plane]"));
    const mobileTerritory = el(root, "[data-cinematic-mobile-category-territory]");
    const mobileRail = el(root, "[data-cinematic-mobile-category-rail]");
    const productWorld = el(root, "[data-cinematic-product-world]");
    const productHeading = el(root, "[data-cinematic-product-heading]");
    const commerceStage = el(root, "[data-kt-scene='commerce'] [data-home-sticky-stage]");
    const productPlanes = Array.from(root.querySelectorAll<HTMLElement>("[data-cinematic-product-plane]"));
    const productMedias = productPlanes.map((plane) => plane.querySelector<HTMLElement>("span"));
    const productImages = productMedias.map((media) => media?.querySelector<HTMLImageElement>("img"));
    const productInfo = el(root, "[data-cinematic-product-info]");
    const carry = el(root, "[data-product-carry-layer]");
    const carryImage = img(root, "[data-product-carry-image]");
    const box = el(root, "[data-cinematic-box]");
    const parcelRead = el(root, "[data-cinematic-parcel-read]");
    const parcelBridge = el(root, "[data-cinematic-parcel-bridge]");
    const pickupCopy = el(root, "[data-cinematic-pickup-copy]");
    const freightRead = el(root, "[data-cinematic-freight-read]");
    const freightBridge = el(root, "[data-cinematic-freight-bridge]");
    const boxPlate = img(root, "[data-box-plate]");
    const vehicle = (kind: "pickup" | "delivery") => ({
      stage: el(root, `[data-cinematic-vehicle='${kind}']`),
      plate: img(root, `[data-vehicle-plate='${kind}']`),
    });
    const pickup = vehicle("pickup");
    const delivery = vehicle("delivery");
    const packedWord = el(root, "[data-pickup-word='packed']");
    const collectedWord = el(root, "[data-pickup-word='collected']");
    const routeStage = el(root, "[data-cinematic-route-camera]");
    const routeWorld = el(root, "[data-cinematic-route-world]");
    const routeVan = el(root, "[data-cinematic-route-van]");
    const routeVanLower = img(root, "[data-cinematic-route-van-lower]");
    const routeVanUpper = img(root, "[data-cinematic-route-van-upper]");
    const routeCopy = el(root, "[data-route-copy='moving']");
    const routeBridge = el(root, "[data-cinematic-route-bridge]");
    const truck = el(root, "[data-cinematic-red-truck]");
    const truckImage = img(root, "[data-cinematic-red-truck-image]");
    const freightReveal = el(root, "[data-cinematic-freight-reveal]");
    const handoff = el(root, "[data-cinematic-handoff]");
    const handoffPlate = img(root, "[data-handoff-plate]");
    const lastMileCopy = el(root, "[data-cinematic-last-mile-copy]");
    const delivered = el(root, "[data-cinematic-delivered]");
    const pickupBridge = el(root, "[data-cinematic-pickup-bridge]");
    const deliveryBridge = el(root, "[data-cinematic-delivery-bridge]");
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
    let truckWidth = 0;
    let boxRect = new DOMRect(window.innerWidth * .3, window.innerHeight * .3, window.innerWidth * .4, window.innerWidth * .4);
    let lastTone: "light" | "dark" | null = null;
    const selectedProduct = selectedProductId && products.slice(0, 5).some((product) => product.id === selectedProductId) ? selectedProductId : products[0]?.id;
    let selectedCategory = categories[0]?.id;
    let frozenProductId: string | undefined;
    let carrySource: DOMRect | undefined;
    let raf = 0;
    let resizeTimer = 0;
    let latestChapter: HomeChapter = "hero";
    let latestProgress = 0;
    const plateCache = new Map<string, HTMLImageElement>();
    const preloadPlate = (src: string) => {
      if (plateCache.has(src)) return plateCache.get(src)!;
      const plate = new Image();
      plate.onload = () => schedule();
      plate.src = src;
      plateCache.set(src, plate);
      return plate;
    };
    const showPlate = (target: HTMLImageElement | null, plates: readonly string[], index: number) => {
      if (!target) return;
      for (let i = Math.max(0, index - 1); i <= Math.min(plates.length - 1, index + 2); i++) preloadPlate(plates[i]);
      const src = plates[index];
      const ready = preloadPlate(src);
      if (ready.complete && ready.naturalWidth && !target.src.endsWith(src)) target.src = src;
      if (target === pickup.plate || target === delivery.plate) target.dataset.plateFormat = isTightVanPlate(target.getAttribute("src") ?? "") ? "tight" : "wide";
    };

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
      truckWidth = truck?.offsetWidth ?? 0;
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
      visible(mobileTerritory, mobile && isCommerce && p >= .10 && p < .69 ? 1 : 0);
      if (isCommerce && !mobile) {
        categoryPlanes.forEach((plane, index) => {
          const targetX = (index - f.categoryPosition) * viewportWidth * .52;
          gsap.set(plane, { transform: `translate3d(calc(-50% + ${targetX}px),-50%,0)`, zIndex: categoryPlanes.length - index, pointerEvents: Math.abs(index - f.categoryPosition) <= 1 ? "auto" : "none" });
        });
        const index = Math.min(categories.length - 1, Math.max(0, Math.round(f.categoryPosition)));
        const id = categories[index]?.id;
        if (id && id !== selectedCategory) { selectedCategory = id; onMarketplaceSelectionChange?.(id); }
      }
      const fanVisible = isCommerce && p >= .60;
      // A solid room rises into place. Crossfading two full-screen galleries
      // leaves both card systems visible and makes the transition feel stacked.
      visible(productWorld, fanVisible ? 1 : 0);
      if (productWorld && isCommerce) gsap.set(productWorld, { yPercent: 100 * (1 - smooth(range(p, .60, .68))) });
      const productRead = isCommerce ? smooth(range(p, .60, .69)) * (1 - range(p, .91, .98)) : 0;
      visible(productHeading, productRead);
      if (productHeading && isCommerce) gsap.set(productHeading, { y: 28 * (1 - smooth(range(p, .60, .69))) - 22 * range(p, .91, .98) });
      // The gallery remains solid as the new room rises over it.
      if (categoryField && isCommerce) gsap.set(categoryField, { y: -viewportHeight * .12 * range(p, .60, .68), autoAlpha: mobile ? 0 : categoryOpacity });
      if (mobileTerritory && isCommerce) gsap.set(mobileTerritory, { y: -viewportHeight * .12 * range(p, .60, .68), autoAlpha: mobile && p >= .10 && p < .69 ? 1 : 0 });
      if (isCommerce && p < B.commerce.selectedTakeover[0]) frozenProductId = undefined;
      if (isCommerce) frozenProductId = selectedProductForTakeover(selectedProduct, frozenProductId, p, B.commerce.selectedTakeover[0]);
      if (fanVisible) {
        const center = Math.max(0, productPlanes.findIndex((plane) => plane.dataset.productId === (frozenProductId ?? selectedProduct)));
        productPlanes.forEach((plane, index) => {
          // The selected product is the actual central plane, including on restoration.
          const offset = centeredFanOffset(index, center, productPlanes.length);
          const distance = Math.abs(offset);
          const spread = f.fanSpread;
          const exit = f.selectedTakeover;
          const x = offset * viewportWidth * (mobile ? .44 : .20) * spread + (index === center ? 0 : Math.sign(offset || 1) * exit * viewportWidth);
          const y = -viewportHeight * .02 + distance * viewportHeight * .014 * spread + (index === center ? 0 : exit * viewportHeight * .08);
          const scale = (1 - Math.min(distance, 2) * .075 * spread) * (index === center ? 1.025 : 1 - exit * .15);
          const rotation = offset * (mobile ? 3 : 4) * spread;
          gsap.set(plane, { transform: `translate3d(-50%,-50%,0) translate3d(${x}px,${y}px,0) rotate(${rotation}deg) scale(${scale})`, zIndex: index === center ? 60 : 50 - Math.round(distance * 6), autoAlpha: exit > .1 && index !== center ? 1 - exit : 1, pointerEvents: exit > .1 && index !== center ? "none" : "auto" });
          plane.tabIndex = exit > .1 && index !== center ? -1 : 0;
        });
      }
      visible(productInfo, fanVisible && p < .93 ? 1 : 0);

      // The selected source yields its exact viewport rectangle to one fixed carry.
      const selectedPlaneIndex = Math.max(0, productPlanes.findIndex((plane) => plane.dataset.productId === selectedProduct));
      const selectedMedia = productMedias[selectedPlaneIndex];
      const commerceCarry = isCommerce && p >= B.commerce.selectedTakeover[0];
      if (commerceCarry && selectedMedia) {
        const card = selectedMedia.getBoundingClientRect();
        const stageTop = commerceStage?.getBoundingClientRect().top ?? 0;
        carrySource = new DOMRect(card.left, card.top - Math.min(0, stageTop), card.width, card.height);
      }
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
      // The carry replaces the whole selected card. Keeping an empty card
      // behind it exposed a white tile as the sticky room scrolled away.
      if (commerceCarry && carryActive) visible(productPlanes[selectedPlaneIndex] ?? null, 0);
      if (carry) {
        const pose = uniformProductPose({ x: source.left, y: source.top, width: source.width, height: source.height }, productTarget, descend);
        gsap.set(carry, { left: 0, top: 0, width: pose.width, height: pose.height, transformOrigin: "0 0", transform: `translate3d(${pose.x}px,${pose.y}px,0) scale(${pose.scale})`, clipPath: `inset(0 0 ${(isParcel ? f.productOcclusion : 0) * 100}% 0)`, autoAlpha: carryActive ? 1 : 0 });
      }
      const boxVisible = isParcel || (isPickup && p < B.pickup.doorOpen[0]);
      const parcelReadOpacity = isParcel ? smooth(range(p, 0, .13)) * (1 - range(p, .82, .98)) : 0;
      visible(parcelRead, parcelReadOpacity);
      if (parcelRead && isParcel) gsap.set(parcelRead, { y: 24 * (1 - smooth(range(p, 0, .13))) - 18 * range(p, .82, .98) });
      visible(parcelBridge, isParcel ? smooth(range(p, .91, .99)) : isPickup ? 1 - smooth(range(p, 0, .16)) : 0);
      visible(box, boxVisible ? 1 : 0);
      showPlate(boxPlate, BOX_PLATES, isParcel ? plateIndex(p, ...B.parcelization.boxClose, 0, 7) : 7);
      if (box) {
        const handoff = isPickup ? smooth(range(p, 0, B.pickup.doorOpen[0])) : 0;
        gsap.set(box, { x: viewportWidth * .15 * handoff, y: viewportHeight * .06 * handoff, scale: 1 - .82 * handoff });
      }
      if (isPickup) {
        visible(pickup.stage, 1);
        if (pickup.stage) gsap.set(pickup.stage, { xPercent: -50, yPercent: -50, x: viewportWidth * f.pickupX / 100 });
        showPlate(pickup.plate, PICKUP_PLATES, pickupPlateIndex(p));
      } else visible(pickup.stage, 0);
      const pickupRead = isPickup ? smooth(range(p, .04, .16)) * (1 - range(p, .84, .96)) : 0;
      visible(pickupCopy, pickupRead);
      if (pickupCopy && isPickup) gsap.set(pickupCopy, { y: 24 * (1 - smooth(range(p, .04, .16))) - 18 * range(p, .84, .96) });
      visible(packedWord, isPickup ? 1 - smooth(range(p, .45, .55)) : 0);
      visible(collectedWord, isPickup ? smooth(range(p, .45, .55)) : 0);
      if (packedWord && isPickup) gsap.set(packedWord, { y: -18 * range(p, .45, .55) });
      if (collectedWord && isPickup) gsap.set(collectedWord, { y: 18 * (1 - range(p, .45, .55)) });
      visible(pickupBridge, isPickup ? smooth(range(p, .88, .98)) : isNetwork ? 1 - smooth(range(p, 0, .12)) : 0);

      const routeVisible = isNetwork || (isFreight && p < B.freight.redSweepContinue[1]);
      visible(routeStage, routeVisible ? 1 : 0);
      if (routeStage) gsap.set(routeStage, { zIndex: isFreight ? 25 : 29 });
      if (routeVisible && routeWorld) {
        const route = isNetwork ? f.route : resolveHomeCinematicFrame("network", 1, mobile, categories.length, products.length).route;
        const scale = isNetwork ? f.cameraScale : mobile ? 1.1 : .95;
        const anchorX = mobile ? viewportWidth * .52 : viewportWidth * (route.point.y > .40 ? .70 : .56);
        const anchorY = viewportHeight * .54;
        const camera = routeCamera(route.point, { width: worldWidth, height: worldHeight }, { x: anchorX, y: anchorY }, scale);
        gsap.set(routeWorld, { transform: `translate3d(${camera.x}px,${camera.y}px,0) scale(${scale})` });
        preloadCinematicWindow(HOME_ROUTE_VAN_SEQUENCE, route.lowerIndex, mobile);
        visible(routeVan, 1);
        const lowerReady = showCinematicFrame(routeVanLower, HOME_ROUTE_VAN_SEQUENCE[route.lowerIndex], mobile);
        const upperReady = showCinematicFrame(routeVanUpper, HOME_ROUTE_VAN_SEQUENCE[route.upperIndex], mobile);
        visible(routeVanLower, lowerReady ? upperReady ? 1 - route.yawBlend : 1 : 0);
        visible(routeVanUpper, upperReady ? lowerReady ? route.yawBlend : 1 : 0);
        if (routeVan) gsap.set(routeVan, { left: `${route.point.x * 100}%`, top: `${route.point.y * 100}%`, rotation: route.residual, xPercent: -50, yPercent: -50 });
      }
      visible(routeCopy, isNetwork ? range(p, .18, .30) * (1 - range(p, .78, .90)) : 0);
      if (routeCopy && isNetwork) gsap.set(routeCopy, { x: -viewportWidth * .025 * (1 - range(p, .18, .6)) });
      visible(routeBridge, isNetwork ? smooth(range(p, .85, .96)) : isFreight ? 1 - smooth(range(p, 0, .22)) : 0);
      const truckVisible = (isNetwork && p >= B.network.redSweepStart[0]) || (isFreight && p <= B.freight.redSweepContinue[1]);
      if (truckVisible) {
        visible(truck, showCinematicFrame(truckImage, "red-truck-top-00", mobile) ? 1 : 0);
        if (truck) gsap.set(truck, { xPercent: -50, yPercent: -50, x: (f.truckX - 50) * viewportWidth / 100 });
      } else visible(truck, 0);
      if (freightReveal) {
        const metadata = HOME_CINEMATIC_ASSET_BY_ID["red-truck-top-00"];
        const reveal = isFreight && metadata?.visibleBounds ? truckTrailingEdgeReveal(f.truckX * viewportWidth / 100, truckWidth, metadata.width, metadata.visibleBounds, viewportWidth).reveal : 0;
        gsap.set(freightReveal, { clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)` });
      }
      const freightReadOpacity = isFreight ? smooth(range(p, ...B.freight.headlineReveal)) : 0;
      visible(freightRead, freightReadOpacity);
      if (freightRead && isFreight) gsap.set(freightRead, { y: 32 * (1 - freightReadOpacity) });

      if (isLastMile) {
        const handoffStart = B.lastMile.handoff[0];
        const returnStart = B.lastMile.courierReturn[0];
        const paired = p >= handoffStart && p < returnStart;
        visible(delivery.stage, paired ? 0 : 1);
        visible(handoff, paired ? 1 : 0);
        if (delivery.stage) {
          const exit = p < handoffStart ? range(p, B.lastMile.courierWalkRight[0], handoffStart) : 0;
          gsap.set(delivery.stage, { xPercent: -50, yPercent: -50, x: viewportWidth * (f.deliveryX / 100 - .38 * exit) });
        }
        if (handoff) gsap.set(handoff, { xPercent: -50, yPercent: -50, x: viewportWidth * .035 * range(p, handoffStart, returnStart) });
        if (paired) showPlate(handoffPlate, HANDOFF_PLATES, plateIndex(p, handoffStart, returnStart, 0, 11));
        else if (p < handoffStart) showPlate(delivery.plate, DELIVERY_PLATES, deliveryPlateIndex(p));
        else showPlate(delivery.plate, RETURN_PLATES, plateIndex(p, returnStart, B.lastMile.doorClose[1], 0, 6));
      } else { visible(delivery.stage, 0); visible(handoff, 0); }
      visible(lastMileCopy, isLastMile ? smooth(range(p, .03, .13)) * (1 - range(p, .39, .53)) : 0);
      if (lastMileCopy && isLastMile) gsap.set(lastMileCopy, { y: 28 * (1 - smooth(range(p, .03, .13))) - 20 * range(p, .39, .53) });
      visible(delivered, isFinale ? 1 - range(p, .18, .32) : 0);
      visible(deliveryBridge, isLastMile ? smooth(range(p, .94, .99)) : 0);
      visible(brand, isFinale ? f.brand : 0);
      if (brand && isFinale) gsap.set(brand, { y: 35 * (1 - f.brand) });
      visible(utility, isFinale ? f.utility : 0);
      visible(legal, isFinale ? f.legal : 0);
      preloadCinematicTier(chapter, p, mobile);
      if (debug) {
        root.dataset.homeChapter = chapter;
        root.dataset.homeProgress = p.toFixed(3);
        root.dataset.homeMotionOwner = f.motionOwner;
        const family = isParcel ? "mechanical-box" : isPickup ? "composed-pickup" : isNetwork ? "route-van" : isLastMile ? "composed-last-mile" : "";
        const index = isNetwork ? f.route.lowerIndex : -1;
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
      const stage = el(root, `[data-kt-scene='${current.chapter}'] [data-home-sticky-stage]`);
      // The sticky stage scrolls out with its chapter; fading it during that
      // release leaves an empty viewport before the next chapter enters.
      if (stage) gsap.set(stage, { opacity: 1 });
      applyFilm(current.chapter, authored);
      if (prefersReducedMotion && window.scrollY >= current.progressEnd) {
        if (current.chapter === "parcelization") visible(parcelBridge, 1);
        if (current.chapter === "pickup") visible(pickupBridge, 1);
        if (current.chapter === "network") visible(routeBridge, 1);
        if (current.chapter === "last-mile") visible(deliveryBridge, 1);
      }
      // Hold the freight message through the physical sticky release. Its
      // chapter is still on screen for one viewport after the film reaches 1.
      visible(freightBridge, current.chapter === "freight" && window.scrollY >= current.progressEnd ? 1 : current.chapter === "last-mile" ? 1 - smooth(range(progress, 0, .08)) : 0);
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
  }, [rootRef, categories, products, selectedProductId, enabled, onMarketplaceSelectionChange, prefersReducedMotion, setHeaderTone]);
}
