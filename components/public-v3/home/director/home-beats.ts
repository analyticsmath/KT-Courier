export type Beat = readonly [number, number];
export function clamp01(progress: number): number { return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)); }
export function range(progress: number, start: number, end: number): number { return end <= start ? (progress >= end ? 1 : 0) : clamp01((progress - start) / (end - start)); }
export function smooth(progress: number): number { const p = clamp01(progress); return p * p * (3 - 2 * p); }
export function before(progress: number, point: number): boolean { return progress < point; }
export function after(progress: number, point: number): boolean { return progress >= point; }
export function within(progress: number, start: number, end: number): boolean { return progress >= start && progress < end; }

export type CommerceBeatMap = {
  apertureReveal: Beat;
  apertureReadHold: Beat;
  apertureClear: Beat;
  categoryTraversal: Beat;
  categoryFinalHold: Beat;
  storeReveal: Beat;
  storeTraversal: Beat;
  storeExit: Beat;
  fanBuild: Beat;
  fanTraversal: Beat;
  selectedTakeover: Beat;
};

const NO_STORE_COMMERCE_BEATS: CommerceBeatMap = {
  apertureReveal: [0, .08],
  apertureReadHold: [.08, .13],
  apertureClear: [.13, .18],
  categoryTraversal: [.16, .54],
  categoryFinalHold: [.54, .59],
  storeReveal: [.59, .59],
  storeTraversal: [.59, .59],
  storeExit: [.59, .59],
  fanBuild: [.56, .64],
  fanTraversal: [.64, .91],
  selectedTakeover: [.91, 1],
};

const STORE_COMMERCE_BEATS: CommerceBeatMap = {
  apertureReveal: [0, .08],
  apertureReadHold: [.08, .13],
  apertureClear: [.13, .18],
  categoryTraversal: [.16, .46],
  categoryFinalHold: [.46, .5],
  storeReveal: [.46, .52],
  storeTraversal: [.52, .66],
  storeExit: [.66, .71],
  fanBuild: [.68, .75],
  fanTraversal: [.75, .92],
  selectedTakeover: [.92, 1],
};

export function getCommerceBeats(storeCount = 0): CommerceBeatMap {
  return storeCount >= 3 ? STORE_COMMERCE_BEATS : NO_STORE_COMMERCE_BEATS;
}

export const HOME_BEATS = {
  hero: { posterRead: [0, .13], entryReveal: [.13, .22], travellingTurn: [.22, .4], centreSettle: [.4, .5], centreTurn: [.5, .58], frontalEstablish: [.58, .66], frontalBlend: [.58, .62], frontalHold: [.62, .66], frontalApproach: [.66, .78], closeApproach: [.78, .9], cameraPass: [.9, .975], release: [.975, 1] },
  // `commerce` is the no-store default. Use getCommerceBeats(storeCount) for
  // the conditional Store World timeline.
  commerce: NO_STORE_COMMERCE_BEATS,
  parcelization: { selectedCarry: [0, .18], packageEnter: [.18, .36], packageCover: [.36, .48], quietHold: [.48, .72], labelToRoute: [.72, .9], routeTakeover: [.9, 1] },
  network: { routeEstablish: [0, .1], straightTravel: [.1, .32], straightReadHold: [.32, .4], angledTransition: [.4, .48], angledTravel: [.48, .6], angledReadHold: [.6, .68], turningTransition: [.68, .74], turningTravel: [.74, .88], overpassTakeover: [.88, 1] },
  freight: { overpassRelease: [0, .07], redEntry: [.07, .22], redSettle: [.22, .3], freightReadHold: [.3, .4], giantSweepFront: [.4, .54], giantSweepMid: [.54, .68], giantSweepRear: [.68, .81], trailerTakeover: [.81, .93], localWorldReveal: [.93, 1] },
  lastMile: { streetBreath: [0, .06], vanEntry: [.06, .18], vanApproach: [.18, .23], vanSettle: [.23, .29], vanDoorOpen: [.29, .43], courierReveal: [.43, .48], courierWalk: [.48, .6], recipientReveal: [.52, .6], preHandoff: [.6, .68], combinedHandoff: [.68, .8], separation: [.8, .84], courierTurn: [.84, .88], courierReturn: [.88, .93], vanDoorClose: [.93, .97], vanDeparture: [.97, 1] },
  finale: { deliveredHold: [0, .18], environmentFalloff: [.18, .32], brandRise: [.32, .68], brandHold: [.68, .86], utilityReveal: [.86, .95], legalReveal: [.95, 1] },
} as const;
