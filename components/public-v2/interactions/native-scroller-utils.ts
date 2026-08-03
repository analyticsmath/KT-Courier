export function clampNativeScrollerIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;

  return Math.max(0, Math.min(index, itemCount - 1));
}

export function getNativeScrollerProgress(activeIndex: number, itemCount: number) {
  const index = clampNativeScrollerIndex(activeIndex, itemCount);

  return {
    current: itemCount > 0 ? index + 1 : 0,
    total: itemCount,
    ratio: itemCount > 0 ? (index + 1) / itemCount : 0,
  };
}

export function getNativeScrollerKeyboardTarget(
  key: string,
  activeIndex: number,
  itemCount: number,
): number | null {
  if (itemCount <= 0) return null;

  switch (key) {
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
    case "ArrowLeft":
      return clampNativeScrollerIndex(activeIndex - 1, itemCount);
    case "ArrowRight":
      return clampNativeScrollerIndex(activeIndex + 1, itemCount);
    default:
      return null;
  }
}

export function getNativeScrollerScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

export function isNativeScrollerNestedControl(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;

  return Boolean(target.closest(
    "a, button, input, textarea, select, [contenteditable='true'], [role='textbox']",
  ));
}
