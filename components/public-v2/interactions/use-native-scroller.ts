"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEventHandler,
} from "react";
import { usePrefersReducedMotion } from "@/lib/ui/use-prefers-reduced-motion";
import type { NativeScrollerAlignment, NativeScrollerResult } from "./native-scroller-types";
import {
  clampNativeScrollerIndex,
  getNativeScrollerKeyboardTarget,
  getNativeScrollerScrollBehavior,
  isNativeScrollerNestedControl,
} from "./native-scroller-utils";

type UseNativeScrollerOptions = {
  itemCount: number;
  itemSelector: string;
  initialIndex: number;
  alignment: NativeScrollerAlignment;
  step: "item" | "viewport";
  keyboardNavigation: boolean;
  onActiveIndexChange?: (index: number) => void;
};

function getRailItems(track: HTMLUListElement, selector: string): HTMLElement[] {
  return Array.from(track.querySelectorAll<HTMLElement>(selector));
}

function findClosestItemIndex(viewport: HTMLElement, items: readonly HTMLElement[]): number {
  if (items.length === 0) return 0;
  if (viewport.scrollLeft <= 1) return 0;
  if (viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1) return items.length - 1;

  const viewportRect = viewport.getBoundingClientRect();
  const viewportCenter = viewportRect.left + (viewportRect.width / 2);
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  items.forEach((item, index) => {
    const itemRect = item.getBoundingClientRect();
    const itemCenter = itemRect.left + (itemRect.width / 2);
    const distance = Math.abs(itemCenter - viewportCenter);

    if (distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  });

  return closestIndex;
}

/**
 * Enhances a semantic native overflow list. The list remains scrollable and
 * readable before hydration; this hook only adds controls, keyboard movement,
 * and a stable active-item signal after hydration.
 */
export function useNativeScroller({
  itemCount: providedItemCount,
  itemSelector,
  initialIndex,
  alignment,
  step,
  keyboardNavigation,
  onActiveIndexChange,
}: UseNativeScrollerOptions): NativeScrollerResult {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const mountedRef = useRef(false);
  const initialActiveIndex = clampNativeScrollerIndex(initialIndex, providedItemCount);
  const activeIndexRef = useRef(initialActiveIndex);
  const itemCountRef = useRef(providedItemCount);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [itemCount, setItemCount] = useState(providedItemCount);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    onActiveIndexChangeRef.current = onActiveIndexChange;
  }, [onActiveIndexChange]);

  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
  }, []);

  const setTrackRef = useCallback((node: HTMLUListElement | null) => {
    trackRef.current = node;
  }, []);

  const setActiveItem = useCallback((
    nextIndex: number,
    nextItemCount = itemCountRef.current,
    syncDomState = false,
  ) => {
    const index = clampNativeScrollerIndex(nextIndex, nextItemCount);
    if (activeIndexRef.current === index && !syncDomState) return;

    const track = trackRef.current;

    if (track) {
      const items = getRailItems(track, itemSelector);
      items.forEach((item, itemIndex) => {
        if (itemIndex === index) {
          item.dataset.nativeScrollerActive = "true";
        } else {
          delete item.dataset.nativeScrollerActive;
        }
      });
    }

    if (activeIndexRef.current === index) return;

    activeIndexRef.current = index;
    if (!mountedRef.current) return;

    setActiveIndex(index);
    onActiveIndexChangeRef.current?.(index);
  }, [itemSelector]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    let animationFrame: number | null = null;
    let disposed = false;

    const syncItemCount = () => {
      if (disposed) return;

      const nextItemCount = getRailItems(track, itemSelector).length;
      itemCountRef.current = nextItemCount;
      setItemCount((current) => (current === nextItemCount ? current : nextItemCount));
      setActiveItem(activeIndexRef.current, nextItemCount, true);
    };

    const syncActiveItem = () => {
      animationFrame = null;
      if (disposed) return;

      const items = getRailItems(track, itemSelector);
      if (items.length === 0) return;

      setActiveItem(findClosestItemIndex(viewport, items), items.length);
    };

    const scheduleSync = () => {
      if (disposed || animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(syncActiveItem);
    };

    syncItemCount();
    scheduleSync();

    const intersectionObserver = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(scheduleSync, {
        root: viewport,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      });

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
        if (disposed) return;

        syncItemCount();
        scheduleSync();
      });

    const items = getRailItems(track, itemSelector);
    items.forEach((item) => {
      intersectionObserver?.observe(item);
      resizeObserver?.observe(item);
    });
    resizeObserver?.observe(viewport);

    viewport.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync, { passive: true });

    return () => {
      disposed = true;
      viewport.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [itemSelector, setActiveItem]);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;

    const items = getRailItems(track, itemSelector);
    const nextIndex = clampNativeScrollerIndex(index, items.length);
    const item = items[nextIndex];
    if (!item) return;

    item.scrollIntoView({
      behavior: getNativeScrollerScrollBehavior(reducedMotion),
      block: "nearest",
      inline: alignment,
    });
    setActiveItem(nextIndex, items.length);
  }, [alignment, itemSelector, reducedMotion, setActiveItem]);

  const getStepTarget = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport || step === "item") {
      return clampNativeScrollerIndex(activeIndexRef.current + direction, itemCountRef.current);
    }

    const viewportRect = viewport.getBoundingClientRect();
    const targetCenter = viewportRect.left + (viewportRect.width / 2) + (direction * viewportRect.width);
    const eligibleItems = getRailItems(track, itemSelector)
      .map((item, index) => {
        const itemRect = item.getBoundingClientRect();

        return {
          index,
          center: itemRect.left + (itemRect.width / 2),
        };
      })
      .filter(({ index }) => direction < 0 ? index < activeIndexRef.current : index > activeIndexRef.current);

    if (eligibleItems.length === 0) return activeIndexRef.current;

    return eligibleItems.reduce((closest, item) => (
      Math.abs(item.center - targetCenter) < Math.abs(closest.center - targetCenter) ? item : closest
    )).index;
  }, [itemSelector, step]);

  const goPrevious = useCallback(() => {
    const target = getStepTarget(-1);
    goTo(target);
    return target;
  }, [getStepTarget, goTo]);

  const goNext = useCallback(() => {
    const target = getStepTarget(1);
    goTo(target);
    return target;
  }, [getStepTarget, goTo]);

  const onKeyDown = useCallback<KeyboardEventHandler<HTMLDivElement>>((event) => {
    if (!keyboardNavigation || isNativeScrollerNestedControl(event.target)) return;

    const targetIndex = getNativeScrollerKeyboardTarget(event.key, activeIndexRef.current, itemCountRef.current);
    if (targetIndex === null) return;

    event.preventDefault();
    goTo(targetIndex);
  }, [goTo, keyboardNavigation]);

  return {
    activeIndex,
    itemCount,
    isAtStart: activeIndex === 0,
    isAtEnd: itemCount === 0 || activeIndex === itemCount - 1,
    setViewportRef,
    setTrackRef,
    goTo,
    goPrevious,
    goNext,
    onKeyDown,
  };
}
