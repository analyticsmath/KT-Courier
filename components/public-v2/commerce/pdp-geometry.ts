interface CenteredStickyPlacementInput {
  viewportHeight: number;
  headerHeight: number;
  planeHeight: number;
  railViewportTop: number;
  safeMargin?: number;
}

interface CenteredStickyPlacement {
  viewportCenter: number;
  stickyTop: number;
  initialOffset: number;
  tooTall: boolean;
}

export function computeCenteredStickyPlacement({
  viewportHeight,
  headerHeight,
  planeHeight,
  railViewportTop,
  safeMargin = 16,
}: CenteredStickyPlacementInput): CenteredStickyPlacement {
  const usableHeight = Math.max(0, viewportHeight - headerHeight);
  const viewportCenter = headerHeight + usableHeight / 2;
  const tooTall = planeHeight > Math.max(0, usableHeight - safeMargin * 2);

  if (tooTall) {
    return {
      viewportCenter,
      stickyTop: headerHeight + safeMargin,
      initialOffset: 0,
      tooTall: true,
    };
  }

  const stickyTop = viewportCenter - planeHeight / 2;
  return {
    viewportCenter,
    stickyTop,
    initialOffset: Math.max(0, stickyTop - railViewportTop),
    tooTall: false,
  };
}
