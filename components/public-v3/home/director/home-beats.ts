export type Beat = readonly [number, number];

export function clamp01(progress: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
}

/** Maps a chapter progress value into a named normalized beat. */
export function range(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp01((progress - start) / (end - start));
}

export function before(progress: number, point: number): boolean {
  return progress < point;
}

export function after(progress: number, point: number): boolean {
  return progress >= point;
}

export function within(progress: number, start: number, end: number): boolean {
  return progress >= start && progress < end;
}

/**
 * Normalized story beats for the six canonical homepage chapters. Hero values
 * are intentionally unchanged; post-Hero values describe grouped worlds.
 */
export const HOME_BEATS = {
  hero: {
    posterRead: [0, 0.13],
    entryReveal: [0.13, 0.22],
    travellingTurn: [0.22, 0.4],
    centreSettle: [0.4, 0.5],
    centreTurn: [0.5, 0.58],
    frontalEstablish: [0.58, 0.66],
    frontalBlend: [0.58, 0.62],
    frontalHold: [0.62, 0.66],
    frontalApproach: [0.66, 0.78],
    closeApproach: [0.78, 0.9],
    cameraPass: [0.9, 0.975],
    release: [0.975, 1],
  },
  marketplace: {
    categoryTraversal: [0, 0.84],
    portalBuild: [0.84, 0.875],
    portalHold: [0.875, 0.91],
    exitSlices: [0.91, 0.955],
    mediaHandoff: [0.955, 1],
  },
  preparation: {
    mediaTransfer: [0, 0.18],
    quietHold: [0.18, 0.76],
    streetReveal: [0.76, 1],
  },
  journey: {
    streetEstablish: [0, 0.08],
    vanEntry: [0.08, 0.25],
    vanBrake: [0.25, 0.31],
    vanHold: [0.31, 0.4],
    vanDoor: [0.4, 0.5],
    courierApproach: [0.5, 0.59],
    courierLift: [0.59, 0.67],
    parcelLoad: [0.67, 0.74],
    custodyHold: [0.74, 0.8],
    roadGrow: [0.8, 0.9],
    routeReveal: [0.9, 0.92],
    routeTravel: [0.92, 1],
    routeExit: [0.98, 1],
  },
  freight: {
    environment: [0, 0.08],
    truckEntry: [0.08, 0.28],
    truckBrake: [0.28, 0.34],
    truckHold: [0.34, 0.45],
    servicesRise: [0.45, 0.58],
    servicesHold: [0.58, 0.72],
    truckResume: [0.72, 0.84],
    destinationTakeover: [0.84, 1],
  },
  finale: {
    arrivalWorld: [0, 0.08],
    courierHandoff: [0.08, 0.32],
    deliveredHold: [0.32, 0.42],
    brandRise: [0.42, 0.72],
    brandHold: [0.72, 0.84],
    arrivalFade: [0.72, 0.82],
    utilityReveal: [0.84, 0.92],
    legalReveal: [0.93, 1],
  },
} as const satisfies Record<string, Record<string, Beat>>;
