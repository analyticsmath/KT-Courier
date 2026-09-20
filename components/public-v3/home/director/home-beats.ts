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
  marketplace: { incoming: [0, 0.24], hold: [0.24, 0.72], departure: [0.72, 1], ownerThreshold: 0.82 },
  fan: {
    imageArrives: [0, 0.12],
    spread: [0.12, 0.28],
    fullHold: [0.28, 0.52],
    compress: [0.52, 0.68],
    selectedHold: [0.68, 0.82],
    contract: [0.82, 0.93],
    parcelHandoff: [0.93, 1],
  },
  preparation: {
    transfer: [0, 0.18],
    settle: [0.18, 0.3],
    readyHold: [0.3, 0.7],
    anticipation: [0.7, 0.84],
    collectionUnderlay: [0.84, 1],
  },
  collection: {
    street: [0, 0.1],
    vanApproach: [0.1, 0.3],
    brake: [0.3, 0.37],
    settle: [0.37, 0.42],
    vanHold: [0.42, 0.55],
    door: [0.55, 0.7],
    courierApproach: [0.64, 0.76],
    lift: [0.76, 0.85],
    load: [0.85, 0.94],
    resolved: [0.94, 1],
    liftMask: [0.755, 0.785],
    loadMask: [0.845, 0.875],
  },
  custody: {
    merchant: [0, 0.18],
    approachSeam: [0.18, 0.38],
    seamHold: [0.38, 0.56],
    networkOwns: [0.56, 0.72],
    roadEnters: [0.72, 0.86],
    routePrepared: [0.86, 1],
  },
  route: {
    reveal: [0, 0.1],
    straightTravel: [0.1, 0.3],
    straightHold: [0.3, 0.42],
    firstApproach: [0.42, 0.56],
    firstOcclusion: [0.56, 0.64],
    firstSwap: [0.58, 0.62],
    angledTravel: [0.64, 0.74],
    angledHold: [0.74, 0.8],
    secondOcclusion: [0.8, 0.88],
    secondSwap: [0.82, 0.86],
    turningReveal: [0.88, 0.94],
    freightOverlap: [0.94, 1],
    truckRelease: 0.985,
  },
  freight: {
    establish: [0, 0.14],
    entry: [0.14, 0.32],
    settle: [0.32, 0.4],
    silhouetteHold: [0.4, 0.58],
    cameraPressure: [0.58, 0.72],
    climaxArrival: [0.72, 0.82],
    climaxHold: [0.82, 0.92],
    release: [0.92, 1],
  },
  arrival: {
    quietWorld: [0, 0.12],
    walkIn: [0.12, 0.34],
    settle: [0.34, 0.44],
    humanHold: [0.44, 0.58],
    handoffPrep: [0.58, 0.7],
    concealedSwap: [0.7, 0.78],
    handoff: [0.78, 0.88],
    finalHold: [0.88, 1],
    handoffMask: [0.695, 0.81],
    footerRelease: [0.92, 1],
  },
} as const satisfies Record<string, Record<string, number | Beat>>;
