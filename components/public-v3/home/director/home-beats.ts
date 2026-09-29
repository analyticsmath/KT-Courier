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
  hero: { posterRead: [0, .13], entryReveal: [.13, .24], turnTravel: [.24, .66], frontSettle: [.66, .72], fullBodyApproach: [.72, .9], deepApproach: [.9, .965], cameraPass: [.965, .995], finalClear: [.995, 1] },
  // `commerce` is the no-store default. Use getCommerceBeats(storeCount) for
  // the conditional Store World timeline.
  commerce: NO_STORE_COMMERCE_BEATS,
  parcelization: { selectedCarry: [0, .18], packageEnter: [.18, .36], packageCover: [.36, .48], quietHold: [.48, .72], labelToRoute: [.72, .9], routeTakeover: [.9, 1] },
  network: { routeEstablish: [0, .1], straightTravel: [.1, .32], straightReadHold: [.32, .4], angledTransition: [.4, .48], angledTravel: [.48, .6], angledReadHold: [.6, .68], turningTransition: [.68, .74], turningTravel: [.74, .88], overpassTakeover: [.88, 1] },
  freight: { overpassRelease: [0, .07], redEntry: [.07, .22], redSettle: [.22, .3], freightReadHold: [.3, .4], giantSweepFront: [.4, .54], giantSweepMid: [.54, .68], giantSweepRear: [.68, .81], trailerTakeover: [.81, .93], localWorldReveal: [.93, 1] },
  lastMile: { streetBreath: [0, .06], vanEntry: [.06, .18], vanApproach: [.18, .23], vanSettle: [.23, .29], vanDoorOpen: [.29, .43], courierReveal: [.43, .48], courierWalk: [.48, .6], recipientReveal: [.52, .6], preHandoff: [.6, .68], combinedHandoff: [.68, .8], separation: [.8, .84], courierTurn: [.84, .88], courierReturn: [.88, .93], vanDoorClose: [.93, .97], vanDeparture: [.97, 1] },
  finale: { deliveredHold: [0, .18], environmentFalloff: [.18, .32], brandRise: [.32, .68], brandHold: [.68, .86], utilityReveal: [.86, .95], legalReveal: [.95, 1] },
} as const;

// The mobile van retains its accepted, whole-vehicle approach and release.
export const HOME_MOBILE_HERO_BEATS = {
  frontSettle: [.66, .73],
  frontApproach: [.73, .92],
  frontHold: [.92, .97],
  release: [.97, 1],
} as const;

/** Canonical post-Hero film timing. Kept separate from the retired actor bank. */
export const HOME_CINEMATIC_BEATS = {
  commerce: { takeoverCover: [0, .08], spinnerEnter: [.08, .12], spinnerTurn: [.12, .24], spinnerResolve: [.24, .30], categoryTraversal: [.30, .58], categoryFinalHold: [.58, .62], fanStackIn: [.62, .68], fanSpread: [.68, .76], fanTraversal: [.76, .92], selectedTakeover: [.92, 1] },
  parcelization: { selectedCarry: [0, .14], productDescend: [.14, .30], productOcclusion: [.26, .36], boxClose: [.36, .64], closedHold: [.64, .78], pickupPreload: [.72, .90], collectionTakeover: [.86, 1] },
  pickup: { vanEntry: [0, .14], vanSettle: [.14, .20], doorOpen: [.20, .34], courierApproach: [.34, .44], loadParcel: [.44, .66], withdraw: [.66, .74], doorClose: [.74, .86], vanDeparture: [.86, 1] },
  network: { routeTakeover: [0, .08], closeCamera: [0, .14], horizontalTravel: [.08, .32], cameraPullback: [.14, .38], curveTurn: [.32, .52], verticalTravel: [.52, .76], milestoneReframe: [.66, .84], redPrepare: [.82, .90], redSweepStart: [.90, 1] },
  freight: { redSweepContinue: [0, .18], headlineReveal: [.12, .30], readHold: [.30, .60], detailReveal: [.46, .70], lastMilePrepare: [.72, 1] },
  lastMile: { vanEntry: [0, .12], vanSettle: [.12, .18], doorOpen: [.18, .30], courierEmerge: [.30, .42], courierWalkRight: [.42, .52], handoff: [.52, .78], separation: [.76, .82], courierReturn: [.82, .90], doorClose: [.90, .96], vanDeparture: [.96, 1] },
  finale: { deliveredHold: [0, .22], environmentClear: [.18, .30], brandRise: [.28, .62], brandHold: [.62, .82], utilityReveal: [.82, .94], legalReveal: [.94, 1] },
} as const;
