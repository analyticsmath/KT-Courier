import type { HomeChapter } from "./home-chapters";
import { HOME_CINEMATIC_BEATS as B, clamp01, range, smooth } from "./home-beats";
import { HOME_ROUTE_VAN_SEQUENCE } from "../data/home-cinematic-assets.generated";
import { boxFlapPose, routeYawBlend } from "./home-cinematic-mechanics";

export type CinematicMotionOwner = "hero-terminal-hold" | "marketplace-takeover" | "category-territory" | "product-stack" | "product-fan" | "selected-product" | "product-to-box" | "box-close" | "pickup-van" | "pickup-door" | "pickup-load" | "pickup-release" | "route-camera" | "route-van" | "road-type" | "red-truck-transition" | "freight-read" | "delivery-van" | "delivery-door" | "delivery-courier" | "handoff" | "courier-return" | "finale-delivered" | "finale-brand" | "finale-utility";

export type Point = { x: number; y: number };
export type RoutePose = { point: Point; tangent: number; bucket: number; residual: number; index: number; lowerIndex: number; upperIndex: number; yawBlend: number };
export type CinematicFrame = {
  chapter: HomeChapter;
  progress: number;
  motionOwner: CinematicMotionOwner;
  cover: number;
  categoryPosition: number;
  fanSpread: number;
  selectedTakeover: number;
  productDescend: number;
  productOcclusion: number;
  boxFlaps: ReturnType<typeof boxFlapPose>;
  pickupX: number;
  pickupDoor: number;
  pickupCourierX: number;
  routeProgress: number;
  cameraScale: number;
  route: RoutePose;
  truckX: number;
  deliveryX: number;
  deliveryDoor: number;
  deliveryCourierX: number;
  parcelTransfer: number;
  recipientX: number;
  returnCourierX: number;
  brand: number;
  utility: number;
  legal: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);
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
  const yaw = routeYawBlend(tangent, HOME_ROUTE_VAN_SEQUENCE.length);
  const bucket = yaw.lowerIndex * 15;
  return { point, tangent, bucket, residual: yaw.residual, index: yaw.lowerIndex, lowerIndex: yaw.lowerIndex, upperIndex: yaw.upperIndex, yawBlend: yaw.blend };
}

export function routeCamera(point: Point, world: { width: number; height: number }, screen: Point, scale: number): Point {
  return { x: screen.x - point.x * world.width * scale, y: screen.y - point.y * world.height * scale };
}

export function heroVisibleUnderMarketplace(cover: number): boolean {
  return clamp01(cover) < .999;
}

export function resolveHomeCinematicFrame(chapter: HomeChapter, progress: number, mobile: boolean, categoryCount: number, productCount: number): CinematicFrame {
  void productCount;
  const p = clamp01(progress);
  const route = routePose(0);
  const f: CinematicFrame = {
    chapter, progress: p, motionOwner: "hero-terminal-hold", cover: 0, categoryPosition: 0, fanSpread: 0, selectedTakeover: 0,
    productDescend: 0, productOcclusion: 0, boxFlaps: boxFlapPose(0), pickupX: -100, pickupDoor: 0, pickupCourierX: 0, routeProgress: 0, cameraScale: mobile ? 1.9 : 1.65, route,
    truckX: -160, deliveryX: 180, deliveryDoor: 0, deliveryCourierX: 0, parcelTransfer: 0, recipientX: 0, returnCourierX: 0, brand: 0, utility: 0, legal: 0,
  };
  if (chapter === "hero") return f;
  if (chapter === "commerce") {
    const b = B.commerce;
    f.cover = smooth(range(p, ...b.takeoverCover));
    f.categoryPosition = range(p, ...b.categoryTraversal) * Math.max(0, categoryCount - 1);
    f.fanSpread = smooth(range(p, ...b.fanSpread));
    f.selectedTakeover = range(p, ...b.selectedTakeover);
    f.motionOwner = p < b.takeoverCover[1] ? "marketplace-takeover" : p < b.fanStackIn[0] ? "category-territory" : p < b.fanSpread[0] ? "product-stack" : p < b.selectedTakeover[0] ? "product-fan" : "selected-product";
    return f;
  }
  if (chapter === "parcelization") {
    const b = B.parcelization;
    f.productDescend = smooth(range(p, ...b.productDescend));
    f.productOcclusion = range(p, ...b.productOcclusion);
    f.boxFlaps = boxFlapPose(range(p, ...b.boxClose));
    f.motionOwner = p < b.productDescend[0] ? "selected-product" : p < b.boxClose[0] ? "product-to-box" : "box-close";
    return f;
  }
  if (chapter === "pickup") {
    const b = B.pickup;
    f.pickupX = p < b.vanEntry[1] ? lerp(-95, 0, smooth(range(p, ...b.vanEntry))) : p < b.vanDeparture[0] ? 0 : lerp(0, 115, smooth(range(p, ...b.vanDeparture)));
    f.pickupDoor = p < b.doorClose[0] ? smooth(range(p, ...b.doorOpen)) : 1 - smooth(range(p, ...b.doorClose));
    f.pickupCourierX = lerp(28, 0, smooth(range(p, ...b.courierApproach))) - 14 * smooth(range(p, ...b.loadParcel));
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
    f.motionOwner = p < b.redSweepContinue[1] ? "red-truck-transition" : "freight-read";
    return f;
  }
  if (chapter === "last-mile") {
    const b = B.lastMile;
    f.deliveryX = p < b.vanEntry[1] ? lerp(115, 0, smooth(range(p, ...b.vanEntry))) : p < b.vanDeparture[0] ? 0 : lerp(0, -120, smooth(range(p, ...b.vanDeparture)));
    f.deliveryDoor = p < b.doorClose[0] ? smooth(range(p, ...b.doorOpen)) : 1 - smooth(range(p, ...b.doorClose));
    f.deliveryCourierX = 28 * smooth(range(p, ...b.courierWalkRight));
    f.parcelTransfer = smooth(range(p, ...b.handoff));
    f.recipientX = 30 * smooth(range(p, ...b.separation));
    f.returnCourierX = -27 * smooth(range(p, ...b.courierReturn));
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
