import type { KeyboardEventHandler, ReactNode, RefCallback } from "react";

export type NativeScrollerAlignment = "start" | "center";
export type NativeScrollerStep = "item" | "viewport";
export type NativeScrollerProgressStyle = "count" | "bar" | "both" | "none";

export type NativeScrollerProps = {
  id: string;
  label: string;
  labelledBy?: string;
  children: ReactNode;
  itemCount: number;
  itemSelector?: string;
  initialIndex?: number;
  alignment?: NativeScrollerAlignment;
  step?: NativeScrollerStep;
  controls?: boolean;
  progress?: NativeScrollerProgressStyle;
  keyboardNavigation?: boolean;
  className?: string;
  viewportClassName?: string;
  trackClassName?: string;
  controlsClassName?: string;
  onActiveIndexChange?: (index: number) => void;
};

export type NativeScrollerControlOptions = {
  announce?: boolean;
};

export type NativeScrollerController = {
  activeIndex: number;
  itemCount: number;
  isAtStart: boolean;
  isAtEnd: boolean;
  goTo: (index: number, options?: NativeScrollerControlOptions) => void;
  goPrevious: () => number;
  goNext: () => number;
};

export type NativeScrollerBindings = {
  setViewportRef: RefCallback<HTMLDivElement>;
  setTrackRef: RefCallback<HTMLUListElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
};

export type NativeScrollerResult = NativeScrollerController & NativeScrollerBindings;
