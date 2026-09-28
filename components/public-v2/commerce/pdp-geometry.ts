interface CenteredStickyTopInput {
  viewportHeight: number;
  headerHeight: number;
  planeHeight: number;
  safeMargin?: number;
}

export function computeCenteredStickyTop({
  viewportHeight,
  headerHeight,
  planeHeight,
  safeMargin = 16,
}: CenteredStickyTopInput) {
  const usableHeight = Math.max(0, viewportHeight - headerHeight);
  const tooTall = planeHeight > Math.max(0, usableHeight - safeMargin * 2);

  return {
    top: tooTall
      ? headerHeight + safeMargin
      : headerHeight + (usableHeight - planeHeight) / 2,
    tooTall,
  };
}
