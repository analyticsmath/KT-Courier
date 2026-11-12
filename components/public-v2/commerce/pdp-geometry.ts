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


/**
 * An overflowing sticky purchase rail is its own scroll container.
 * Browser focus() may not scroll such a container when a parent rail is
 * sticky, leaving a focused action below the viewport on short desktops.
 * Return only the corrective local scroll amount; never scroll the document.
 */
export function focusedPurchaseRailScrollDelta(input: Readonly<{
  targetTop: number;
  targetBottom: number;
  railTop: number;
  railBottom: number;
  viewportHeight: number;
  headerBottom: number;
  safeMargin?: number;
}>): number {
  const margin = input.safeMargin ?? 12;
  const visibleTop = Math.max(input.railTop, input.headerBottom) + margin;
  const visibleBottom = Math.min(input.railBottom, input.viewportHeight) - margin;
  if (visibleBottom <= visibleTop) return 0;
  if (input.targetBottom > visibleBottom) return input.targetBottom - visibleBottom;
  if (input.targetTop < visibleTop) return input.targetTop - visibleTop;
  return 0;
}
