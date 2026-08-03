"use client";

import { useState } from "react";
import type { NativeScrollerController, NativeScrollerProgressStyle } from "./native-scroller-types";
import { ScrollerProgress } from "./ScrollerProgress";
import styles from "./native-scroller.module.css";

type ScrollerControlsProps = {
  controller: NativeScrollerController;
  label: string;
  viewportId: string;
  progress: NativeScrollerProgressStyle;
  className?: string;
};

export function ScrollerControls({
  controller,
  label,
  viewportId,
  progress,
  className,
}: ScrollerControlsProps) {
  const [announcement, setAnnouncement] = useState("");

  const announce = (index: number) => {
    setAnnouncement(`Item ${index + 1} of ${controller.itemCount}`);
  };

  const handlePrevious = () => {
    announce(controller.goPrevious());
  };

  const handleNext = () => {
    announce(controller.goNext());
  };

  return (
    <div className={`${styles.controls}${className ? ` ${className}` : ""}`}>
      <ScrollerProgress
        activeIndex={controller.activeIndex}
        itemCount={controller.itemCount}
        presentation={progress}
      />
      <div className={styles.buttonGroup}>
        <button
          aria-controls={viewportId}
          aria-label={`Show previous ${label} item`}
          className={styles.button}
          disabled={controller.isAtStart}
          onClick={handlePrevious}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path d="m14 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </button>
        <button
          aria-controls={viewportId}
          aria-label={`Show next ${label} item`}
          className={styles.button}
          disabled={controller.isAtEnd}
          onClick={handleNext}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path d="m10 5 7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </button>
      </div>
      <span aria-live="polite" className={styles.liveStatus}>{announcement}</span>
    </div>
  );
}
