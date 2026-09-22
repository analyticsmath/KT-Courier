export type Beat = readonly [number, number];
export function clamp01(progress: number): number { return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)); }
export function range(progress: number, start: number, end: number): number { return end <= start ? (progress >= end ? 1 : 0) : clamp01((progress - start) / (end - start)); }
export function smooth(progress: number): number { const p = clamp01(progress); return p * p * (3 - 2 * p); }
export function before(progress: number, point: number): boolean { return progress < point; }
export function after(progress: number, point: number): boolean { return progress >= point; }
export function within(progress: number, start: number, end: number): boolean { return progress >= start && progress < end; }
export const HOME_BEATS = {
  hero: { posterRead: [0, .13], entryReveal: [.13, .22], travellingTurn: [.22, .4], centreSettle: [.4, .5], centreTurn: [.5, .58], frontalEstablish: [.58, .66], frontalBlend: [.58, .62], frontalHold: [.62, .66], frontalApproach: [.66, .78], closeApproach: [.78, .9], cameraPass: [.9, .975], release: [.975, 1] },
  commerce: { apertureReveal: [0, .08], categoryTraversal: [.08, .5], categoryFinalHold: [.5, .56], storeReveal: [.56, .6], storeTraversal: [.6, .73], storeFinalHold: [.73, .76], fanBuild: [.76, .8], fanTraversal: [.8, .94], selectedTakeover: [.94, 1] },
  parcelization: { selectedCarry: [0, .18], packageEnter: [.18, .36], packageCover: [.36, .48], quietHold: [.48, .72], labelToRoute: [.72, .9], routeTakeover: [.9, 1] },
  network: { routeEstablish: [0, .1], straightTravel: [.1, .32], straightReadHold: [.32, .4], angledTransition: [.4, .48], angledTravel: [.48, .6], angledReadHold: [.6, .68], turningTransition: [.68, .74], turningTravel: [.74, .88], overpassTakeover: [.88, 1] },
  freight: { overpassRelease: [0, .07], redEntry: [.07, .22], redSettle: [.22, .3], freightReadHold: [.3, .4], giantSweepFront: [.4, .54], giantSweepMid: [.54, .68], giantSweepRear: [.68, .81], trailerTakeover: [.81, .93], localWorldReveal: [.93, 1] },
  lastMile: { streetBreath: [0, .06], vanEntry: [.06, .18], vanApproach: [.18, .23], vanSettle: [.23, .29], vanDoorOpen: [.29, .43], courierReveal: [.43, .48], courierWalk: [.48, .6], recipientReveal: [.52, .6], preHandoff: [.6, .68], combinedHandoff: [.68, .8], separation: [.8, .84], courierTurn: [.84, .88], courierReturn: [.88, .93], vanDoorClose: [.93, .97], vanDeparture: [.97, 1] },
  finale: { deliveredHold: [0, .18], environmentFalloff: [.18, .32], brandRise: [.32, .68], brandHold: [.68, .86], utilityReveal: [.86, .95], legalReveal: [.95, 1] },
} as const;
