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
    finalCardHold: [0.84, 0.9],
    exitSlices: [0.9, 1],
  },
  preparation: {
    mediaTransfer: [0, 0.18],
    quietHold: [0.18, 0.76],
    streetReveal: [0.76, 1],
  },
  journey: {
    streetEstablish: [0, 0.06],
    vanEntry: [0.06, 0.2],
    vanBrake: [0.2, 0.24],
    vanHold: [0.24, 0.31],
    vanDoor: [0.31, 0.4],
    courierApproach: [0.4, 0.49],
    courierLift: [0.49, 0.57],
    parcelLoad: [0.57, 0.65],
    custodyHold: [0.65, 0.71],
    roadGrow: [0.71, 0.82],
    routeReveal: [0.82, 0.88],
    routeTravel: [0.88, 1],
  },
  freight: {
    routeContinuation: [0, 0.16],
    environment: [0, 0.07],
    truckEntry: [0.07, 0.25],
    truckBrake: [0.25, 0.3],
    truckHold: [0.3, 0.4],
    servicesRise: [0.4, 0.55],
    servicesHold: [0.55, 0.7],
    truckResume: [0.7, 0.84],
    destinationTakeover: [0.84, 1],
  },
  finale: {
    arrivalWorld: [0, 0.12],
    delivered: [0.12, 0.3],
    brandRise: [0.3, 0.66],
    arrivalFade: [0.66, 0.8],
    brandHold: [0.8, 0.9],
    utilityReveal: [0.9, 0.96],
    legalReveal: [0.96, 1],
  },
} as const satisfies Record<string, Record<string, Beat>>;
