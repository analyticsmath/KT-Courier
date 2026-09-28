/** One authority for the desktop orbit and its phase director. All values are milliseconds. */
export const CATEGORY_SPINNER_TIMING = {
  introSpinMs: 3500,
  introResolveMs: 550,
  selectionCenterMs: 250,
  selectionSpinMs: 2250,
  selectionResolveMs: 400,
  returnFoldMs: 200,
  returnSpinMs: 1800,
  returnResolveMs: 350,
  // Preserve the existing compact and reduced-motion phase timings.
  compactIntroResolveMs: 600,
  compactIntroFinishMs: 750,
  compactSelectionCenterMs: 90,
  compactSelectionFinishMs: 570,
  compactReturnFoldMs: 100,
  compactReturnFinishMs: 470,
  reducedSelectionFinishMs: 150,
  reducedReturnFinishMs: 150,
} as const;
