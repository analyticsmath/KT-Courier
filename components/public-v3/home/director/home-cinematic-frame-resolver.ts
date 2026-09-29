import type { HomeChapter } from "./home-chapters";
import { HOME_CINEMATIC_BEATS as B, clamp01, range, smooth } from "./home-beats";
import { HOME_BOX_SEQUENCE, HOME_PICKUP_SEQUENCE, HOME_DELIVERY_SEQUENCE, HOME_HANDOFF_SEQUENCE, HOME_RETURN_SEQUENCE, HOME_ROUTE_VAN_SEQUENCE } from "../data/home-cinematic-assets.generated";
import { categoryOrbitAngle } from "../../../public-v2/commerce/category-orbit-geometry";

export type CinematicMotionOwner = "hero-terminal-hold" | "marketplace-takeover" | "category-orbit" | "category-territory" | "product-stack" | "product-fan" | "selected-product" | "product-to-box" | "box-close" | "pickup-van" | "pickup-door" | "pickup-load" | "pickup-release" | "route-camera" | "route-van" | "road-type" | "red-truck-transition" | "freight-read" | "delivery-van" | "delivery-door" | "delivery-courier" | "handoff" | "courier-return" | "finale-delivered" | "finale-brand" | "finale-utility";

export type Point = { x: number; y: number };
export type RoutePose = { point: Point; tangent: number; bucket: number; residual: number; index: number };
export type CinematicFrame = {
  chapter: HomeChapter;
  progress: number;
  motionOwner: CinematicMotionOwner;
  cover: number;
  orbit: number;
  orbitResolve: number;
  categoryPosition: number;
  fanSpread: number;
  fanPosition: number;
  selectedTakeover: number;
  productDescend: number;
  productOcclusion: number;
  boxIndex: number;
  pickupIndex: number;
  pickupX: number;
  routeProgress: number;
  cameraScale: number;
  route: RoutePose;
  truckX: number;
  freightReveal: number;
  deliveryIndex: number;
  deliveryX: number;
  handoffIndex: number;
  handoffX: number;
  returnIndex: number;
  brand: number;
  utility: number;
  legal: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);
export function sequenceIndex(progress: number, start: number, end: number, count: number): number {
  if (count < 1) return -1;
  return Math.min(count - 1, Math.max(0, Math.round(range(progress, start, end) * (count - 1))));
}
const segmentIndex = (p: number, start: number, end: number, first: number, last: number) => first + sequenceIndex(p, start, end, last - first + 1);

export function pickupFrameIndex(p: number): number {
  const b = B.pickup;
  if (p < b.doorOpen[0]) return 0;
  if (p < b.courierApproach[0]) return segmentIndex(p, ...b.doorOpen, 1, 5);
  if (p < b.loadParcel[0]) return segmentIndex(p, ...b.courierApproach, 6, 7);
  if (p < b.withdraw[0]) return segmentIndex(p, ...b.loadParcel, 8, 11);
  if (p < b.doorClose[0]) return segmentIndex(p, ...b.withdraw, 12, 13);
  return segmentIndex(p, ...b.doorClose, 14, HOME_PICKUP_SEQUENCE.length - 1);
}

export function deliveryFrameIndex(p: number): number {
  const b = B.lastMile;
  if (p < b.doorOpen[0]) return 0;
  if (p < b.courierEmerge[0]) return segmentIndex(p, ...b.doorOpen, 1, 5);
  if (p < b.courierWalkRight[0]) return segmentIndex(p, ...b.courierEmerge, 6, 8);
  return segmentIndex(p, ...b.courierWalkRight, 9, HOME_DELIVERY_SEQUENCE.length - 1);
}

export function returnFrameIndex(p: number): number {
  const b = B.lastMile;
  if (p < b.courierReturn[0]) return 0;
  if (p < b.doorClose[0]) return segmentIndex(p, ...b.courierReturn, 0, 3);
  return segmentIndex(p, ...b.doorClose, 4, HOME_RETURN_SEQUENCE.length - 1);
}

/** The approved road's main line: left-to-right at y≈.19, then clockwise to x≈.73. */
export function routePoint(progress: number): Point {
  const p = clamp01(progress);
  if (p <= .43) return { x: lerp(-.04, .665, p / .43), y: .19 };
  if (p <= .64) {
    const t = (p - .43) / .21;
    const u = 1 - t;
    return {
      x: u * u * u * .665 + 3 * u * u * t * .71 + 3 * u * t * t * .73 + t * t * t * .73,
      y: u * u * u * .19 + 3 * u * u * t * .19 + 3 * u * t * t * .27 + t * t * t * .36,
    };
  }
  return { x: .73, y: lerp(.36, 1.03, (p - .64) / .36) };
}

export function routePose(progress: number): RoutePose {
  const p = clamp01(progress);
  const point = routePoint(p);
  const behind = routePoint(Math.max(0, p - .001));
  const ahead = routePoint(Math.min(1, p + .001));
  // Correct tangent for the road's 1671 × 941 source coordinate system.
  const tangent = Math.atan2((ahead.y - behind.y) * 941, (ahead.x - behind.x) * 1671) * 180 / Math.PI;
  const bucket = Math.max(0, Math.min(90, Math.round(tangent / 15) * 15));
  return { point, tangent, bucket, residual: Math.max(-7.5, Math.min(7.5, tangent - bucket)), index: Math.min(HOME_ROUTE_VAN_SEQUENCE.length - 1, bucket / 15) };
}

export function routeCamera(point: Point, world: { width: number; height: number }, screen: Point, scale: number): Point {
  return { x: screen.x - point.x * world.width * scale, y: screen.y - point.y * world.height * scale };
}

/** Same five-face rotateY ring geometry as the Shop atlas, driven by scroll. */
export function categoryOrbitPose(index: number, count: number, progress: number, mobile: boolean) {
  const angle = categoryOrbitAngle(index, count, clamp01(progress));
  const radians = angle * Math.PI / 180;
  const radius = mobile ? 106 : 320;
  return { angle, x: Math.sin(radians) * radius, z: Math.cos(radians) * radius, rotationY: -angle, scale: .66 + .34 * ((Math.cos(radians) + 1) / 2) };
}

export function selectedProductIndex(count: number, fanPosition: number, takeover: number, frozenIndex?: number): number {
  if (!count) return -1;
  if (takeover > 0 && frozenIndex !== undefined) return Math.max(0, Math.min(count - 1, frozenIndex));
  return Math.max(0, Math.min(count - 1, Math.round(fanPosition)));
}

export function heroVisibleUnderMarketplace(cover: number): boolean {
  return clamp01(cover) < .999;
}

export function resolveHomeCinematicFrame(chapter: HomeChapter, progress: number, mobile: boolean, categoryCount: number, productCount: number): CinematicFrame {
  const p = clamp01(progress);
  const route = routePose(0);
  const f: CinematicFrame = {
    chapter, progress: p, motionOwner: "hero-terminal-hold", cover: 0, orbit: 0, orbitResolve: 0, categoryPosition: 0, fanSpread: 0, fanPosition: 0, selectedTakeover: 0,
    productDescend: 0, productOcclusion: 0, boxIndex: 0, pickupIndex: 0, pickupX: -100, routeProgress: 0, cameraScale: mobile ? 1.9 : 1.65, route,
    truckX: -160, freightReveal: 0, deliveryIndex: 0, deliveryX: 180, handoffIndex: 0, handoffX: 0, returnIndex: 0, brand: 0, utility: 0, legal: 0,
  };
  if (chapter === "hero") return f;
  if (chapter === "commerce") {
    const b = B.commerce;
    f.cover = smooth(range(p, ...b.takeoverCover));
    f.orbit = range(p, b.spinnerEnter[0], b.spinnerTurn[1]);
    f.orbitResolve = smooth(range(p, ...b.spinnerResolve));
    f.categoryPosition = range(p, ...b.categoryTraversal) * Math.max(0, categoryCount - 1);
    f.fanSpread = smooth(range(p, ...b.fanSpread));
    f.fanPosition = range(p, ...b.fanTraversal) * Math.max(0, productCount - 1);
    f.selectedTakeover = range(p, ...b.selectedTakeover);
    f.motionOwner = p < b.takeoverCover[1] ? "marketplace-takeover" : p < b.spinnerResolve[1] ? "category-orbit" : p < b.fanStackIn[0] ? "category-territory" : p < b.fanSpread[0] ? "product-stack" : p < b.selectedTakeover[0] ? "product-fan" : "selected-product";
    return f;
  }
  if (chapter === "parcelization") {
    const b = B.parcelization;
    f.productDescend = smooth(range(p, ...b.productDescend));
    f.productOcclusion = range(p, ...b.productOcclusion);
    f.boxIndex = sequenceIndex(p, ...b.boxClose, HOME_BOX_SEQUENCE.length);
    f.motionOwner = p < b.productDescend[0] ? "selected-product" : p < b.boxClose[0] ? "product-to-box" : "box-close";
    return f;
  }
  if (chapter === "pickup") {
    const b = B.pickup;
    f.pickupIndex = pickupFrameIndex(p);
    f.pickupX = p < b.vanEntry[1] ? lerp(-95, 0, smooth(range(p, ...b.vanEntry))) : p < b.vanDeparture[0] ? 0 : lerp(0, 115, smooth(range(p, ...b.vanDeparture)));
    f.motionOwner = p < b.doorOpen[0] ? "pickup-van" : p < b.courierApproach[0] ? "pickup-door" : p < b.withdraw[0] ? "pickup-load" : "pickup-release";
    return f;
  }
  if (chapter === "network") {
    const b = B.network;
    f.routeProgress = range(p, b.horizontalTravel[0], b.redPrepare[0]);
    f.route = routePose(f.routeProgress);
    f.cameraScale = lerp(mobile ? 1.9 : 1.65, mobile ? 1.1 : .95, smooth(range(p, ...b.cameraPullback)));
    if (p >= b.redSweepStart[0]) f.truckX = lerp(-150, 20, range(p, ...b.redSweepStart));
    f.motionOwner = p >= b.redSweepStart[0] ? "red-truck-transition" : p < b.cameraPullback[1] ? "route-camera" : p < b.milestoneReframe[0] ? "route-van" : "road-type";
    return f;
  }
  if (chapter === "freight") {
    const b = B.freight;
    f.truckX = p < b.redSweepContinue[1] ? lerp(20, 180, smooth(range(p, ...b.redSweepContinue))) : 180;
    f.freightReveal = clamp01((f.truckX - 55) / 100);
    f.motionOwner = p < b.redSweepContinue[1] ? "red-truck-transition" : "freight-read";
    return f;
  }
  if (chapter === "last-mile") {
    const b = B.lastMile;
    f.deliveryIndex = deliveryFrameIndex(p);
    f.deliveryX = p < b.vanEntry[1] ? lerp(115, 0, smooth(range(p, ...b.vanEntry))) : p < b.vanDeparture[0] ? 0 : lerp(0, -120, smooth(range(p, ...b.vanDeparture)));
    f.handoffIndex = sequenceIndex(p, ...b.handoff, HOME_HANDOFF_SEQUENCE.length);
    f.handoffX = p < b.separation[0] ? 0 : lerp(0, -22, range(p, ...b.separation));
    f.returnIndex = returnFrameIndex(p);
    f.motionOwner = p < b.doorOpen[0] ? "delivery-van" : p < b.courierEmerge[0] ? "delivery-door" : p < b.handoff[0] ? "delivery-courier" : p < b.courierReturn[0] ? "handoff" : "courier-return";
    return f;
  }
  const b = B.finale;
  f.brand = smooth(range(p, ...b.brandRise));
  f.utility = range(p, ...b.utilityReveal);
  f.legal = range(p, ...b.legalReveal);
  f.motionOwner = p < b.brandRise[0] ? "finale-delivered" : p < b.utilityReveal[0] ? "finale-brand" : "finale-utility";
  return f;
}
