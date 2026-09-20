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
    poster: [0, 0.07],
    truckApproach: [0.07, 0.23],
    decelerate: [0.23, 0.31],
    suspensionSettle: [0.31, 0.36],
    readingHold: [0.36, 0.51],
    anticipation: [0.51, 0.59],
    accelerate: [0.59, 0.73],
    trailerDominance: [0.73, 0.82],
    cargoLock: [0.82, 0.88],
    oneToThree: [0.88, 0.94],
    threeToFive: [0.94, 0.98],
    handoff: [0.98, 1],
  },
  marketplace: { segmentHold: 0.78 },
  fan: {
    imageArrives: [0, 0.12],
    spread: [0.12, 0.32],
    fullHold: [0.32, 0.5],
    compress: [0.5, 0.68],
    selectedHold: [0.68, 0.8],
    contract: [0.8, 0.92],
    parcelHandoff: [0.92, 1],
  },
  collection: {
    street: [0, 0.08],
    vanApproach: [0.08, 0.3],
    brake: [0.3, 0.38],
    settle: [0.38, 0.43],
    vanHold: [0.43, 0.52],
    door: [0.52, 0.68],
    courierApproach: [0.62, 0.76],
    lift: [0.76, 0.84],
    load: [0.84, 0.94],
    resolved: [0.94, 1],
  },
  custody: {
    merchant: [0, 0.18],
    approachSeam: [0.18, 0.4],
    seamHold: [0.4, 0.54],
    networkOwns: [0.54, 0.74],
    roadEnters: [0.74, 0.88],
    routePrepared: [0.88, 1],
  },
  route: {
    reveal: [0, 0.1],
    straightTravel: [0.1, 0.28],
    straightHold: [0.28, 0.4],
    firstApproach: [0.4, 0.54],
    firstOcclusion: [0.54, 0.64],
    firstSwap: [0.58, 0.62],
    angledReveal: [0.64, 0.72],
    angledHold: [0.72, 0.78],
    secondOcclusion: [0.78, 0.88],
    secondCover: [0.8, 0.88],
    secondSwap: [0.82, 0.86],
    turningReveal: [0.88, 0.94],
    freightOverlap: [0.94, 1],
    truckRelease: 0.98,
  },
  freight: {
    establish: [0, 0.12],
    entry: [0.12, 0.3],
    entryOcclusion: [0.3, 0.38],
    sideTravel: [0.38, 0.56],
    silhouetteHold: [0.56, 0.68],
    climaxPrep: [0.68, 0.78],
    climax: [0.78, 0.88],
    climaxHold: [0.88, 0.94],
    release: [0.94, 1],
  },
  arrival: {
    quietWorld: [0, 0.14],
    walkIn: [0.14, 0.4],
    settle: [0.4, 0.52],
    handoffPrep: [0.52, 0.64],
    concealedSwap: [0.64, 0.78],
    handoff: [0.78, 0.9],
    finalHold: [0.9, 1],
  },
} as const satisfies Record<string, Record<string, number | Beat>>;

export const HOME_LAYOUT = {
  heroTruckPath: {
    arrivalX: [0.08, 0.58],
    holdX: 0.58,
    accelerationX: 0.84,
    cargoX: 0.96,
  },
} as const;
