/**
 * KT COURIERS — AUTHORITATIVE TYPED MEDIA REGISTRY
 *
 * Generated from Phase A/B media inventory & Sharp WebP derivation.
 * All route components and scenes import media exclusively through this registry.
 * No hardcoded filenames or random paths allowed in visual components.
 */

export interface KTMediaAsset {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  aspectRatio: number;
  focalPoint: readonly [number, number] | [number, number];
  hasAlpha: boolean;
  webpSrc?: string;
  pngSrc?: string;
  srcSet?: string;
  desktopCrop: "full-bleed" | "optical-center" | "baseline-ground" | "side-anchored";
  mobileCrop: "portrait-slice" | "cab-focus" | "courier-upper" | "horizontal-crawl";
  textSafeRegion: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center-clear";
}

export const ktMedia = {
  home: {
    heroTruck: {
      sideRight: {
    id: "protagonist.truck.white.side-right",
    src: "/media/public/protagonists/protagonist-truck-white-side-right.webp",
    alt: "KT Couriers long haul transport truck side profile facing right",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.55],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-side-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-side-right.png",
    
    desktopCrop: "baseline-ground",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      sideLeft: {
    id: "protagonist.truck.white.side-left",
    src: "/media/public/protagonists/protagonist-truck-white-side-left.webp",
    alt: "KT Couriers long haul transport truck side profile facing left",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.55],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-side-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-side-left.png",
    
    desktopCrop: "baseline-ground",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      centeredHero: {
    id: "protagonist.truck.white.centered-hero",
    src: "/media/public/protagonists/protagonist-truck-white-centered-hero.webp",
    alt: "KT Couriers flagship long white truck centered hero profile",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.55],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-centered-hero.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-centered-hero.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      front3qRight: {
    id: "protagonist.truck.white.front-3q-right",
    src: "/media/public/protagonists/protagonist-truck-white-front-3q-right.webp",
    alt: "Front three-quarter view of KT white truck approaching",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.45, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-front-3q-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-front-3q-right.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      front3qLeft: {
    id: "protagonist.truck.white.front-3q-left",
    src: "/media/public/protagonists/protagonist-truck-white-front-3q-left.webp",
    alt: "Front three-quarter view of KT white truck angled left",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.55, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-front-3q-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-front-3q-left.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      topDownStraight: {
    id: "protagonist.truck.white.top-down-straight",
    src: "/media/public/protagonists/protagonist-truck-white-top-down-straight.webp",
    alt: "Top-down view of KT Couriers white freight truck in transit corridor",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-top-down-straight.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-top-down-straight.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      topDownTurning: {
    id: "protagonist.truck.white.top-down-turning",
    src: "/media/public/protagonists/protagonist-truck-white-top-down-turning.webp",
    alt: "Top-down view of KT freight truck navigating regional transit turn",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-top-down-turning.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-top-down-turning.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      cargoBoxMaterial: {
    id: "protagonist.truck.white.cargo-box-material",
    src: "/media/public/protagonists/protagonist-truck-white-cargo-box-material.webp",
    alt: "Close crop of white trailer side panel acting as transition surface",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-cargo-box-material.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-cargo-box-material.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      cabCrop: {
    id: "protagonist.truck.white.close-crop-front-cab-only",
    src: "/media/public/protagonists/protagonist-truck-white-close-crop-front-cab-only.webp",
    alt: "KT Couriers fleet truck asset 11_close_crop_front_cab_only.png",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-close-crop-front-cab-only.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-close-crop-front-cab-only.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      rearDoorsOpen: {
    id: "protagonist.truck.white.rear-doors-slightly-open",
    src: "/media/public/protagonists/protagonist-truck-white-rear-doors-slightly-open.webp",
    alt: "KT Couriers fleet truck asset 14_rear_doors_slightly_open.png",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-white-rear-doors-slightly-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-rear-doors-slightly-open.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    },
    van: {
      sideRight: {
    id: "protagonist.van.side-right",
    src: "/media/public/protagonists/protagonist-van-side-right.webp",
    alt: "KT Couriers neighborhood delivery van side view",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-van-side-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-side-right.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      slidingDoorOpen: {
    id: "protagonist.van.sliding-door-open",
    src: "/media/public/protagonists/protagonist-van-sliding-door-open.webp",
    alt: "KT delivery van with sliding side door open for parcel staging",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.55, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-van-sliding-door-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-sliding-door-open.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      rearDoorsOpen: {
    id: "protagonist.van.rear-doors-open",
    src: "/media/public/protagonists/protagonist-van-rear-doors-open.webp",
    alt: "KT delivery van rear cargo doors open ready for loading",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-van-rear-doors-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-rear-doors-open.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      allDoorsOpen: {
    id: "protagonist.van.all-doors-open",
    src: "/media/public/protagonists/protagonist-van-all-doors-open.webp",
    alt: "KT delivery van open for neighborhood merchant collection",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-van-all-doors-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-all-doors-open.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      centeredHero: {
    id: "protagonist.van.centered-hero",
    src: "/media/public/protagonists/protagonist-van-centered-hero.webp",
    alt: "KT Couriers local delivery vehicle centered hero view",
    width: 1254,
    height: 1254,
    aspectRatio: 1,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-van-centered-hero.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-centered-hero.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      front3qRight: {
    id: "protagonist.van.front-three-quarter-facing-right",
    src: "/media/public/protagonists/protagonist-van-front-three-quarter-facing-right.webp",
    alt: "KT Couriers delivery van asset 03_front_three_quarter_facing_right.png",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-van-front-three-quarter-facing-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-front-three-quarter-facing-right.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    },
    redTruck: {
      sideRight: {
    id: "protagonist.truck.red.side-right",
    src: "/media/public/protagonists/protagonist-truck-red-side-right.webp",
    alt: "KT Couriers heavy freight transport truck with red curtain trailer",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.55],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-red-side-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-side-right.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      centeredHero: {
    id: "protagonist.truck.red.centered-hero",
    src: "/media/public/protagonists/protagonist-truck-red-centered-hero.webp",
    alt: "Heavy logistics red freight truck centered hero profile",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.55],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-red-centered-hero.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-centered-hero.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      curtainOpen: {
    id: "protagonist.truck.red.curtain-open",
    src: "/media/public/protagonists/protagonist-truck-red-curtain-open.webp",
    alt: "Red freight truck with cargo trailer curtain partially opened",
    width: 1672,
    height: 941,
    aspectRatio: 1.777,
    focalPoint: [0.5, 0.55],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-red-curtain-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-curtain-open.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      front3qRight: {
    id: "protagonist.truck.red.front-three-quarter-view-facing-right",
    src: "/media/public/protagonists/protagonist-truck-red-front-three-quarter-view-facing-right.webp",
    alt: "KT Couriers heavy freight truck 03_front_three_quarter_view_facing_right.png",
    width: 1448,
    height: 1086,
    aspectRatio: 1.333,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-truck-red-front-three-quarter-view-facing-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-front-three-quarter-view-facing-right.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    },
    courier: {
      heroStanding: {
    id: "protagonist.courier.hero-standing",
    src: "/media/public/protagonists/protagonist-courier-hero-standing.webp",
    alt: "KT Courier standing confidently in uniform holding parcel",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-hero-standing.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-hero-standing.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      carryOne: {
    id: "protagonist.courier.carry-one-parcel",
    src: "/media/public/protagonists/protagonist-courier-carry-one-parcel.webp",
    alt: "KT Courier carrying parcel ready for transfer",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-carry-one-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-carry-one-parcel.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      walkRightCarryOne: {
    id: "protagonist.courier.walk-right-one-parcel",
    src: "/media/public/protagonists/protagonist-courier-walk-right-one-parcel.webp",
    alt: "KT Courier walking briskly to the right delivering a package",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-walk-right-one-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-walk-right-one-parcel.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      readyHandover: {
    id: "protagonist.courier.ready-handover",
    src: "/media/public/protagonists/protagonist-courier-ready-handover.webp",
    alt: "KT Courier preparing to hand over package to customer",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-ready-handover.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-ready-handover.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      extendingHandoff: {
    id: "protagonist.courier.extending-handoff",
    src: "/media/public/protagonists/protagonist-courier-extending-handoff.webp",
    alt: "KT Courier extending parcel forward completing physical delivery",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-extending-handoff.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-extending-handoff.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      approachVehicle: {
    id: "protagonist.courier.approach-vehicle",
    src: "/media/public/protagonists/protagonist-courier-approach-vehicle.webp",
    alt: "KT Courier approaching transport van with delivery manifest",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-approach-vehicle.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-approach-vehicle.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      loadingUnloading: {
    id: "protagonist.courier.loading-unloading",
    src: "/media/public/protagonists/protagonist-courier-loading-unloading.webp",
    alt: "KT Courier loading packages into delivery vehicle",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.4],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-loading-unloading.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-loading-unloading.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      allPoses: [
        {
    id: "protagonist.courier.hero-standing",
    src: "/media/public/protagonists/protagonist-courier-hero-standing.webp",
    alt: "KT Courier standing confidently in uniform holding parcel",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-hero-standing.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-hero-standing.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.carry-one-parcel",
    src: "/media/public/protagonists/protagonist-courier-carry-one-parcel.webp",
    alt: "KT Courier carrying parcel ready for transfer",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-carry-one-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-carry-one-parcel.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.full-body-two-parcels",
    src: "/media/public/protagonists/protagonist-courier-full-body-two-parcels.webp",
    alt: "KT Courier team member in active delivery pose 03_full_body_two_parcels.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-full-body-two-parcels.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-full-body-two-parcels.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.walk-right-one-parcel",
    src: "/media/public/protagonists/protagonist-courier-walk-right-one-parcel.webp",
    alt: "KT Courier walking briskly to the right delivering a package",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-walk-right-one-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-walk-right-one-parcel.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.walking-one-parcel-facing-left",
    src: "/media/public/protagonists/protagonist-courier-walking-one-parcel-facing-left.webp",
    alt: "KT Courier team member in active delivery pose 05_walking_one_parcel_facing_left.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-walking-one-parcel-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-walking-one-parcel-facing-left.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.walking-two-parcels",
    src: "/media/public/protagonists/protagonist-courier-walking-two-parcels.webp",
    alt: "KT Courier team member in active delivery pose 06_walking_two_parcels.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-walking-two-parcels.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-walking-two-parcels.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.ready-handover",
    src: "/media/public/protagonists/protagonist-courier-ready-handover.webp",
    alt: "KT Courier preparing to hand over package to customer",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-ready-handover.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-ready-handover.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.extending-handoff",
    src: "/media/public/protagonists/protagonist-courier-extending-handoff.webp",
    alt: "KT Courier extending parcel forward completing physical delivery",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-extending-handoff.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-extending-handoff.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.looking-toward-viewer-with-parcel",
    src: "/media/public/protagonists/protagonist-courier-looking-toward-viewer-with-parcel.webp",
    alt: "KT Courier team member in active delivery pose 09_looking_toward_viewer_with_parcel.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-looking-toward-viewer-with-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-looking-toward-viewer-with-parcel.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.approach-vehicle",
    src: "/media/public/protagonists/protagonist-courier-approach-vehicle.webp",
    alt: "KT Courier approaching transport van with delivery manifest",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.35],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-approach-vehicle.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-approach-vehicle.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.looking-left-approaching-vehicle",
    src: "/media/public/protagonists/protagonist-courier-looking-left-approaching-vehicle.webp",
    alt: "KT Courier team member in active delivery pose 11_looking_left_approaching_vehicle.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-looking-left-approaching-vehicle.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-looking-left-approaching-vehicle.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.placing-parcel-down",
    src: "/media/public/protagonists/protagonist-courier-placing-parcel-down.webp",
    alt: "KT Courier team member in active delivery pose 12_placing_parcel_down.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-placing-parcel-down.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-placing-parcel-down.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.lifting-parcel-up",
    src: "/media/public/protagonists/protagonist-courier-lifting-parcel-up.webp",
    alt: "KT Courier team member in active delivery pose 13_lifting_parcel_up.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-lifting-parcel-up.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-lifting-parcel-up.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.small-parcel-one-hand",
    src: "/media/public/protagonists/protagonist-courier-small-parcel-one-hand.webp",
    alt: "KT Courier team member in active delivery pose 14_small_parcel_one_hand.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-small-parcel-one-hand.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-small-parcel-one-hand.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.medium-box-under-arm",
    src: "/media/public/protagonists/protagonist-courier-medium-box-under-arm.webp",
    alt: "KT Courier team member in active delivery pose 15_medium_box_under_arm.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-medium-box-under-arm.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-medium-box-under-arm.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.empty-hands-courier-hero",
    src: "/media/public/protagonists/protagonist-courier-empty-hands-courier-hero.webp",
    alt: "KT Courier team member in active delivery pose 16_empty_hands_courier_hero.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-empty-hands-courier-hero.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-empty-hands-courier-hero.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.forward-gesture-with-parcel",
    src: "/media/public/protagonists/protagonist-courier-forward-gesture-with-parcel.webp",
    alt: "KT Courier team member in active delivery pose 17_forward_gesture_with_parcel.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-forward-gesture-with-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-forward-gesture-with-parcel.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.loading-unloading",
    src: "/media/public/protagonists/protagonist-courier-loading-unloading.webp",
    alt: "KT Courier loading packages into delivery vehicle",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.4],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-loading-unloading.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-loading-unloading.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.half-body-holding-parcel",
    src: "/media/public/protagonists/protagonist-courier-half-body-holding-parcel.webp",
    alt: "KT Courier team member in active delivery pose 19_half_body_holding_parcel.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-half-body-holding-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-half-body-holding-parcel.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
        {
    id: "protagonist.courier.close-crop-upper-body-portrait",
    src: "/media/public/protagonists/protagonist-courier-close-crop-upper-body-portrait.webp",
    alt: "KT Courier team member in active delivery pose 20_close_crop_upper_body_portrait.png",
    width: 1122,
    height: 1402,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    webpSrc: "/media/public/protagonists/protagonist-courier-close-crop-upper-body-portrait.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-close-crop-upper-body-portrait.png",
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  }
      ] as readonly KTMediaAsset[],
    },
  },

  categories: {
    fashion: {
      hero: {
    id: "market.craft.leather-bags",
    src: "/media/public/derived/market-craft-leather-bags-1920w.webp",
    alt: "Handmade leather bags and accessories at Rosebank artisan market",
    width: 2560,
    height: 1707,
    aspectRatio: 1.5,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/market-craft-leather-bags-480w.webp 480w, /media/public/derived/market-craft-leather-bags-768w.webp 768w, /media/public/derived/market-craft-leather-bags-1080w.webp 1080w, /media/public/derived/market-craft-leather-bags-1440w.webp 1440w, /media/public/derived/market-craft-leather-bags-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      streetLook1: {
    id: "market.fashion.jhb-fashion-brown-coat",
    src: "/media/public/derived/market-fashion-jhb-fashion-brown-coat-1920w.webp",
    alt: "Contemporary South African street fashion and apparel",
    width: 2048,
    height: 2560,
    aspectRatio: 0.8,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/market-fashion-jhb-fashion-brown-coat-480w.webp 480w, /media/public/derived/market-fashion-jhb-fashion-brown-coat-768w.webp 768w, /media/public/derived/market-fashion-jhb-fashion-brown-coat-1080w.webp 1080w, /media/public/derived/market-fashion-jhb-fashion-brown-coat-1440w.webp 1440w, /media/public/derived/market-fashion-jhb-fashion-brown-coat-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      streetLook2: {
    id: "market.fashion.jhb-fashion-white-top",
    src: "/media/public/derived/market-fashion-jhb-fashion-white-top-1920w.webp",
    alt: "Contemporary South African street fashion and apparel",
    width: 1922,
    height: 2560,
    aspectRatio: 0.751,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/market-fashion-jhb-fashion-white-top-480w.webp 480w, /media/public/derived/market-fashion-jhb-fashion-white-top-768w.webp 768w, /media/public/derived/market-fashion-jhb-fashion-white-top-1080w.webp 1080w, /media/public/derived/market-fashion-jhb-fashion-white-top-1440w.webp 1440w, /media/public/derived/market-fashion-jhb-fashion-white-top-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      urbanGraffiti: {
    id: "market.local.jhb-fashion-graffiti",
    src: "/media/public/derived/market-local-jhb-fashion-graffiti-1920w.webp",
    alt: "South African local market documentary photography jhb-fashion-graffiti.webp",
    width: 1922,
    height: 2560,
    aspectRatio: 0.751,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/market-local-jhb-fashion-graffiti-480w.webp 480w, /media/public/derived/market-local-jhb-fashion-graffiti-768w.webp 768w, /media/public/derived/market-local-jhb-fashion-graffiti-1080w.webp 1080w, /media/public/derived/market-local-jhb-fashion-graffiti-1440w.webp 1440w, /media/public/derived/market-local-jhb-fashion-graffiti-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    },
    groceries: {
      hero: {
    id: "market.produce.fresh-crates",
    src: "/media/public/derived/market-produce-fresh-crates-1920w.webp",
    alt: "Farm-fresh vegetables and local produce stacked in market crates",
    width: 2560,
    height: 1600,
    aspectRatio: 1.6,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/market-produce-fresh-crates-480w.webp 480w, /media/public/derived/market-produce-fresh-crates-768w.webp 768w, /media/public/derived/market-produce-fresh-crates-1080w.webp 1080w, /media/public/derived/market-produce-fresh-crates-1440w.webp 1440w, /media/public/derived/market-produce-fresh-crates-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      freshGreens: {
    id: "commerce.groceries.fresh-produce",
    src: "/media/public/derived/commerce-groceries-fresh-produce-1920w.webp",
    alt: "Organic crisp green produce for local grocery delivery",
    width: 5184,
    height: 3456,
    aspectRatio: 1.5,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/commerce-groceries-fresh-produce-480w.webp 480w, /media/public/derived/commerce-groceries-fresh-produce-768w.webp 768w, /media/public/derived/commerce-groceries-fresh-produce-1080w.webp 1080w, /media/public/derived/commerce-groceries-fresh-produce-1440w.webp 1440w, /media/public/derived/commerce-groceries-fresh-produce-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    },
    foodDining: {
      hero: {
    id: "market.food.prepared-bowl",
    src: "/media/public/derived/market-food-prepared-bowl-1920w.webp",
    alt: "Freshly prepared healthy grain bowl from a local South African kitchen",
    width: 2560,
    height: 1702,
    aspectRatio: 1.504,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/market-food-prepared-bowl-480w.webp 480w, /media/public/derived/market-food-prepared-bowl-768w.webp 768w, /media/public/derived/market-food-prepared-bowl-1080w.webp 1080w, /media/public/derived/market-food-prepared-bowl-1440w.webp 1440w, /media/public/derived/market-food-prepared-bowl-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    },
    homeLiving: {
      hero: {
    id: "market.craft.ceramics",
    src: "/media/public/derived/market-craft-ceramics-1920w.webp",
    alt: "Artisanal handcrafted ceramic tableware and home decor",
    width: 2560,
    height: 1702,
    aspectRatio: 1.504,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/market-craft-ceramics-480w.webp 480w, /media/public/derived/market-craft-ceramics-768w.webp 768w, /media/public/derived/market-craft-ceramics-1080w.webp 1080w, /media/public/derived/market-craft-ceramics-1440w.webp 1440w, /media/public/derived/market-craft-ceramics-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      interiorVessel: {
    id: "commerce.homeware.vitaly-gariev-1JnN9QhmTGU-unsplash",
    src: "/media/public/derived/commerce-homeware-vitaly-gariev-1JnN9QhmTGU-unsplash-1920w.webp",
    alt: "Curated natural ceramics and architectural homeware",
    width: 3840,
    height: 2160,
    aspectRatio: 1.778,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/commerce-homeware-vitaly-gariev-1JnN9QhmTGU-unsplash-480w.webp 480w, /media/public/derived/commerce-homeware-vitaly-gariev-1JnN9QhmTGU-unsplash-768w.webp 768w, /media/public/derived/commerce-homeware-vitaly-gariev-1JnN9QhmTGU-unsplash-1080w.webp 1080w, /media/public/derived/commerce-homeware-vitaly-gariev-1JnN9QhmTGU-unsplash-1440w.webp 1440w, /media/public/derived/commerce-homeware-vitaly-gariev-1JnN9QhmTGU-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    },
    healthWellness: {
      hero: {
    id: "commerce.wellness.declan-sun-7tc4dlLcXF0-unsplash",
    src: "/media/public/derived/commerce-wellness-declan-sun-7tc4dlLcXF0-unsplash-1920w.webp",
    alt: "Amber glass natural skincare and botanical wellness items",
    width: 6336,
    height: 8191,
    aspectRatio: 0.774,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/commerce-wellness-declan-sun-7tc4dlLcXF0-unsplash-480w.webp 480w, /media/public/derived/commerce-wellness-declan-sun-7tc4dlLcXF0-unsplash-768w.webp 768w, /media/public/derived/commerce-wellness-declan-sun-7tc4dlLcXF0-unsplash-1080w.webp 1080w, /media/public/derived/commerce-wellness-declan-sun-7tc4dlLcXF0-unsplash-1440w.webp 1440w, /media/public/derived/commerce-wellness-declan-sun-7tc4dlLcXF0-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      apothecaryJars: {
    id: "commerce.wellness.karolina-grabowska-AeRjba-rnZ4-unsplash",
    src: "/media/public/derived/commerce-wellness-karolina-grabowska-AeRjba-rnZ4-unsplash-1920w.webp",
    alt: "Amber glass natural skincare and botanical wellness items",
    width: 4252,
    height: 6378,
    aspectRatio: 0.667,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/commerce-wellness-karolina-grabowska-AeRjba-rnZ4-unsplash-480w.webp 480w, /media/public/derived/commerce-wellness-karolina-grabowska-AeRjba-rnZ4-unsplash-768w.webp 768w, /media/public/derived/commerce-wellness-karolina-grabowska-AeRjba-rnZ4-unsplash-1080w.webp 1080w, /media/public/derived/commerce-wellness-karolina-grabowska-AeRjba-rnZ4-unsplash-1440w.webp 1440w, /media/public/derived/commerce-wellness-karolina-grabowska-AeRjba-rnZ4-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
      essentialOils: {
    id: "commerce.wellness.ela-de-pure-dFubjAPlWfI-unsplash",
    src: "/media/public/derived/commerce-wellness-ela-de-pure-dFubjAPlWfI-unsplash-1920w.webp",
    alt: "Amber glass natural skincare and botanical wellness items",
    width: 2400,
    height: 2400,
    aspectRatio: 1,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/commerce-wellness-ela-de-pure-dFubjAPlWfI-unsplash-480w.webp 480w, /media/public/derived/commerce-wellness-ela-de-pure-dFubjAPlWfI-unsplash-768w.webp 768w, /media/public/derived/commerce-wellness-ela-de-pure-dFubjAPlWfI-unsplash-1080w.webp 1080w, /media/public/derived/commerce-wellness-ela-de-pure-dFubjAPlWfI-unsplash-1440w.webp 1440w, /media/public/derived/commerce-wellness-ela-de-pure-dFubjAPlWfI-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    },
  },

  routes: {
    nightTransitCorridor: {
    id: "route.aerial.vije-vijendranath-HBUNTeUfLFo-unsplash",
    src: "/media/public/derived/route-aerial-vije-vijendranath-HBUNTeUfLFo-unsplash-1920w.webp",
    alt: "High-speed logistics highway corridor across Gauteng",
    width: 5472,
    height: 3648,
    aspectRatio: 1.5,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/route-aerial-vije-vijendranath-HBUNTeUfLFo-unsplash-480w.webp 480w, /media/public/derived/route-aerial-vije-vijendranath-HBUNTeUfLFo-unsplash-768w.webp 768w, /media/public/derived/route-aerial-vije-vijendranath-HBUNTeUfLFo-unsplash-1080w.webp 1080w, /media/public/derived/route-aerial-vije-vijendranath-HBUNTeUfLFo-unsplash-1440w.webp 1440w, /media/public/derived/route-aerial-vije-vijendranath-HBUNTeUfLFo-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    aerialHighway: {
    id: "route.aerial.mavic-101-LhgEKILDWTg-unsplash",
    src: "/media/public/derived/route-aerial-mavic-101-LhgEKILDWTg-unsplash-1920w.webp",
    alt: "High-speed logistics highway corridor across Gauteng",
    width: 8192,
    height: 4608,
    aspectRatio: 1.778,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/route-aerial-mavic-101-LhgEKILDWTg-unsplash-480w.webp 480w, /media/public/derived/route-aerial-mavic-101-LhgEKILDWTg-unsplash-768w.webp 768w, /media/public/derived/route-aerial-mavic-101-LhgEKILDWTg-unsplash-1080w.webp 1080w, /media/public/derived/route-aerial-mavic-101-LhgEKILDWTg-unsplash-1440w.webp 1440w, /media/public/derived/route-aerial-mavic-101-LhgEKILDWTg-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    gautengTransitLine: {
    id: "route.aerial.vije-vijendranath-9o5zeS6QbgM-unsplash",
    src: "/media/public/derived/route-aerial-vije-vijendranath-9o5zeS6QbgM-unsplash-1920w.webp",
    alt: "High-speed logistics highway corridor across Gauteng",
    width: 6240,
    height: 4160,
    aspectRatio: 1.5,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/route-aerial-vije-vijendranath-9o5zeS6QbgM-unsplash-480w.webp 480w, /media/public/derived/route-aerial-vije-vijendranath-9o5zeS6QbgM-unsplash-768w.webp 768w, /media/public/derived/route-aerial-vije-vijendranath-9o5zeS6QbgM-unsplash-1080w.webp 1080w, /media/public/derived/route-aerial-vije-vijendranath-9o5zeS6QbgM-unsplash-1440w.webp 1440w, /media/public/derived/route-aerial-vije-vijendranath-9o5zeS6QbgM-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    johannesburgCorridor: {
    id: "route.aerial.chuttersnap-xewrfLD8emE-unsplash",
    src: "/media/public/derived/route-aerial-chuttersnap-xewrfLD8emE-unsplash-1920w.webp",
    alt: "High-speed logistics highway corridor across Gauteng",
    width: 7360,
    height: 4912,
    aspectRatio: 1.498,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/route-aerial-chuttersnap-xewrfLD8emE-unsplash-480w.webp 480w, /media/public/derived/route-aerial-chuttersnap-xewrfLD8emE-unsplash-768w.webp 768w, /media/public/derived/route-aerial-chuttersnap-xewrfLD8emE-unsplash-1080w.webp 1080w, /media/public/derived/route-aerial-chuttersnap-xewrfLD8emE-unsplash-1440w.webp 1440w, /media/public/derived/route-aerial-chuttersnap-xewrfLD8emE-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    mabonengWorkshop: {
    id: "route.aerial.vije-vijendranath-PgSm_blvwLo-unsplash",
    src: "/media/public/derived/route-aerial-vije-vijendranath-PgSm_blvwLo-unsplash-1920w.webp",
    alt: "High-speed logistics highway corridor across Gauteng",
    width: 4964,
    height: 3309,
    aspectRatio: 1.5,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/route-aerial-vije-vijendranath-PgSm_blvwLo-unsplash-480w.webp 480w, /media/public/derived/route-aerial-vije-vijendranath-PgSm_blvwLo-unsplash-768w.webp 768w, /media/public/derived/route-aerial-vije-vijendranath-PgSm_blvwLo-unsplash-1080w.webp 1080w, /media/public/derived/route-aerial-vije-vijendranath-PgSm_blvwLo-unsplash-1440w.webp 1440w, /media/public/derived/route-aerial-vije-vijendranath-PgSm_blvwLo-unsplash-1920w.webp 1920w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
  },

  documentary: {
    driverArrival: {
    id: "documentary.r2-doc-02-driver-arrival",
    src: "/media/public/derived/documentary-r2-doc-02-driver-arrival-1440w.webp",
    alt: "Physical custody transfer and parcel verification documentation",
    width: 1600,
    height: 1068,
    aspectRatio: 1.498,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/documentary-r2-doc-02-driver-arrival-480w.webp 480w, /media/public/derived/documentary-r2-doc-02-driver-arrival-768w.webp 768w, /media/public/derived/documentary-r2-doc-02-driver-arrival-1080w.webp 1080w, /media/public/derived/documentary-r2-doc-02-driver-arrival-1440w.webp 1440w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    pickup: {
    id: "documentary.r2-doc-03-pickup",
    src: "/media/public/derived/documentary-r2-doc-03-pickup-1440w.webp",
    alt: "Physical custody transfer and parcel verification documentation",
    width: 1600,
    height: 1068,
    aspectRatio: 1.498,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/documentary-r2-doc-03-pickup-480w.webp 480w, /media/public/derived/documentary-r2-doc-03-pickup-768w.webp 768w, /media/public/derived/documentary-r2-doc-03-pickup-1080w.webp 1080w, /media/public/derived/documentary-r2-doc-03-pickup-1440w.webp 1440w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    trackingCheck: {
    id: "documentary.r2-doc-05-tracking",
    src: "/media/public/derived/documentary-r2-doc-05-tracking-1440w.webp",
    alt: "Physical custody transfer and parcel verification documentation",
    width: 1600,
    height: 1068,
    aspectRatio: 1.498,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/documentary-r2-doc-05-tracking-480w.webp 480w, /media/public/derived/documentary-r2-doc-05-tracking-768w.webp 768w, /media/public/derived/documentary-r2-doc-05-tracking-1080w.webp 1080w, /media/public/derived/documentary-r2-doc-05-tracking-1440w.webp 1440w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    handoffDetail: {
    id: "documentary.r2-doc-06-handoff",
    src: "/media/public/derived/documentary-r2-doc-06-handoff-1440w.webp",
    alt: "Physical custody transfer and parcel verification documentation",
    width: 1600,
    height: 1068,
    aspectRatio: 1.498,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/documentary-r2-doc-06-handoff-480w.webp 480w, /media/public/derived/documentary-r2-doc-06-handoff-768w.webp 768w, /media/public/derived/documentary-r2-doc-06-handoff-1080w.webp 1080w, /media/public/derived/documentary-r2-doc-06-handoff-1440w.webp 1440w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
  },

  auth: {
    customer: {
    id: "auth.kt-auth-01-customer",
    src: "/media/public/derived/auth-kt-auth-01-customer-768w.webp",
    alt: "KT Couriers secure authentication and partner access",
    width: 1000,
    height: 1500,
    aspectRatio: 0.667,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/auth-kt-auth-01-customer-480w.webp 480w, /media/public/derived/auth-kt-auth-01-customer-768w.webp 768w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    merchant: {
    id: "auth.kt-auth-02-merchant",
    src: "/media/public/derived/auth-kt-auth-02-merchant-768w.webp",
    alt: "KT Couriers secure authentication and partner access",
    width: 1001,
    height: 1500,
    aspectRatio: 0.667,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/auth-kt-auth-02-merchant-480w.webp 480w, /media/public/derived/auth-kt-auth-02-merchant-768w.webp 768w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    product: {
    id: "auth.kt-auth-03-product",
    src: "/media/public/derived/auth-kt-auth-03-product-768w.webp",
    alt: "KT Couriers secure authentication and partner access",
    width: 1000,
    height: 1500,
    aspectRatio: 0.667,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/auth-kt-auth-03-product-480w.webp 480w, /media/public/derived/auth-kt-auth-03-product-768w.webp 768w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    recovery: {
    id: "auth.kt-auth-04-recovery",
    src: "/media/public/derived/auth-kt-auth-04-recovery-768w.webp",
    alt: "KT Couriers secure authentication and partner access",
    width: 1000,
    height: 1500,
    aspectRatio: 0.667,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    
    
    srcSet: "/media/public/derived/auth-kt-auth-04-recovery-480w.webp 480w, /media/public/derived/auth-kt-auth-04-recovery-768w.webp 768w",
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
  },

  illustrations: {
    orderDelivery: {
    id: "illustration.order-delivery",
    src: "/media/public/illustrations/Order Delivery.svg",
    alt: "Operational illustration for Order Delivery",
    width: 800,
    height: 800,
    aspectRatio: 1,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    
    
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    packageDelivery: {
    id: "illustration.package-delivery",
    src: "/media/public/illustrations/Package delivery.svg",
    alt: "Operational illustration for Package delivery",
    width: 800,
    height: 800,
    aspectRatio: 1,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    
    
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    gpsLocation: {
    id: "illustration.gps-location",
    src: "/media/public/illustrations/gps location.svg",
    alt: "Operational illustration for gps location",
    width: 800,
    height: 800,
    aspectRatio: 1,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    
    
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    onlineShopping: {
    id: "illustration.kt-ill-online-shopping",
    src: "/media/public/illustrations/kt-ill-online-shopping.svg",
    alt: "Operational illustration for kt-ill-online-shopping",
    width: 800,
    height: 800,
    aspectRatio: 1,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    
    
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
    motionOrderState: {
    id: "illustration.kt-motion-order-state",
    src: "/media/public/illustrations/kt-motion-order-state.svg",
    alt: "Operational illustration for kt-motion-order-state",
    width: 800,
    height: 800,
    aspectRatio: 1,
    focalPoint: [0.5, 0.5],
    hasAlpha: true,
    
    
    
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  },
  },
} as const;

/**
 * Route-level and Scene-level Media Manifests.
 * Ensures routes only load and prewarm the assets they actually need.
 */
export const sceneManifests = {
  homepage: {
    scene00_02_hero: [
      ktMedia.home.heroTruck.sideRight,
      ktMedia.home.heroTruck.centeredHero,
    ],
    scene05_07_marketplace: [
      ktMedia.home.heroTruck.cargoBoxMaterial,
      ktMedia.categories.fashion.hero,
      ktMedia.categories.groceries.hero,
      ktMedia.categories.foodDining.hero,
      ktMedia.categories.homeLiving.hero,
      ktMedia.categories.healthWellness.hero,
    ],
    scene08_10_handoff: [
      ktMedia.documentary.pickup,
      ktMedia.home.van.slidingDoorOpen,
      ktMedia.home.courier.carryOne,
      ktMedia.home.courier.readyHandover,
      ktMedia.documentary.handoffDetail,
    ],
    scene11_12_route: [
      ktMedia.home.heroTruck.topDownStraight,
      ktMedia.home.heroTruck.topDownTurning,
      ktMedia.routes.aerialHighway,
      ktMedia.home.redTruck.sideRight,
    ],
    scene13_14_arrival: [
      ktMedia.home.courier.extendingHandoff,
      ktMedia.home.courier.heroStanding,
    ],
  },
  shop: {
    threshold: [ktMedia.categories.fashion.hero],
    categories: [
      ktMedia.categories.fashion.hero,
      ktMedia.categories.groceries.hero,
      ktMedia.categories.foodDining.hero,
      ktMedia.categories.healthWellness.hero,
      ktMedia.categories.homeLiving.hero,
    ],
  },
} as const;

/**
 * Helper to generate responsive img srcSet string
 */
export function getMediaSrcSet(asset: KTMediaAsset): string | undefined {
  return asset.srcSet;
}

/**
 * Identifies the single authoritative first-viewport LCP asset for a given route.
 */
export function getRouteLcpAsset(pathname: string): KTMediaAsset | null {
  if (pathname === "/") return ktMedia.home.heroTruck.sideRight;
  if (pathname.startsWith("/shop/categories")) return ktMedia.categories.fashion.hero;
  if (pathname.startsWith("/shop")) return ktMedia.categories.fashion.hero;
  if (pathname.startsWith("/services/freight")) return ktMedia.home.redTruck.sideRight;
  if (pathname.startsWith("/services/parcel")) return ktMedia.home.courier.heroStanding;
  if (pathname.startsWith("/services/grocery") || pathname.startsWith("/services/food")) return ktMedia.home.van.sideRight;
  if (pathname.startsWith("/about")) return ktMedia.routes.mabonengWorkshop;
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return ktMedia.auth.customer;
  return null;
}
