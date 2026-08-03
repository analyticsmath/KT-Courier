"use client";

import { cn } from "@/lib/utils/cn";
import { ScrollerControls } from "./ScrollerControls";
import type { NativeScrollerProps } from "./native-scroller-types";
import { useNativeScroller } from "./use-native-scroller";
import styles from "./native-scroller.module.css";

export function NativeScroller({
  id,
  label,
  labelledBy,
  children,
  itemCount,
  itemSelector = "[data-native-scroller-item]",
  initialIndex = 0,
  alignment = "start",
  step = "item",
  controls = true,
  progress = "count",
  keyboardNavigation = true,
  className,
  viewportClassName,
  trackClassName,
  controlsClassName,
  onActiveIndexChange,
}: NativeScrollerProps) {
  const {
    activeIndex,
    itemCount: activeItemCount,
    isAtStart,
    isAtEnd,
    setViewportRef,
    setTrackRef,
    goTo,
    goPrevious,
    goNext,
    onKeyDown,
  } = useNativeScroller({
    itemCount,
    itemSelector,
    initialIndex,
    alignment,
    step,
    keyboardNavigation,
    onActiveIndexChange,
  });
  const controller = {
    activeIndex,
    itemCount: activeItemCount,
    isAtStart,
    isAtEnd,
    goTo,
    goPrevious,
    goNext,
  };

  return (
    <div className={cn(styles.root, className)}>
      {controls ? (
        <ScrollerControls
          className={controlsClassName}
          controller={controller}
          label={label}
          progress={progress}
          viewportId={id}
        />
      ) : null}
      <div
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        className={cn(styles.viewport, viewportClassName)}
        id={id}
        onKeyDown={onKeyDown}
        ref={setViewportRef}
        tabIndex={keyboardNavigation ? 0 : undefined}
      >
        <ul aria-label={label} className={cn(styles.track, trackClassName)} ref={setTrackRef}>
          {children}
        </ul>
      </div>
    </div>
  );
}
